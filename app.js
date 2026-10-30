(() => {
  const tg = window.Telegram?.WebApp;
  tg?.ready();
  tg?.expand();
  const API_BASE = window.STUDYBOT_API_BASE || "";
  const $ = id => document.getElementById(id);
  const initData = tg?.initData || "";
  let me = null;
  function showNotice(message) {
    $("notice").textContent = message;
    $("notice").classList.remove("hidden");
  }
  function escapeHtml(s="") {
    return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  async function api(path, options={}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {"content-type":"application/json","X-Telegram-Init-Data":initData,...(options.headers||{})}
    });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(data.error || `HTTP_${response.status}`);
    return data;
  }
  function renderFiles(files) {
    $("count").textContent = `${files.length} فایل`;
    if (!files.length) {
      $("files").innerHTML = '<div class="empty">فایلی پیدا نشد. فایل‌های تأییدشده بعد از ثبت در اینجا نمایش داده می‌شوند.</div>';
      return;
    }
    $("files").innerHTML = files.map(f => `
      <article class="file">
        <h3>📄 ${escapeHtml(f.title || f.original_name)}</h3>
        <div class="meta">
          ${escapeHtml([f.subject,f.grade,f.chapter].filter(Boolean).join(" · ") || "دسته‌بندی نشده")}<br>
          ${escapeHtml(f.description || "")}<br>
          فرمت: ${escapeHtml((f.extension||"").toUpperCase())}
        </div>
        <a href="#" data-download="${escapeHtml(f.id)}">باز کردن / دریافت فایل</a>
      </article>`).join("");
  }
  async function loadFiles() {
    try {
      const q = $("q").value.trim();
      const data = await api(`/api/files${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      renderFiles(data.files || []);
    } catch(e) {
      if (e.message === "AUTH_REQUIRED") showNotice("این صفحه باید از داخل Telegram Mini App باز شود؛ اطلاعات ورود معتبر دریافت نشد.");
      else if (e.message === "GROUP_MEMBERSHIP_REQUIRED") showNotice("برای استفاده از کتابخانه باید عضو گروه مجاز باشید.");
      else showNotice(`اتصال به سرویس برقرار نشد: ${e.message}. آدرس API را در تنظیمات این صفحه بررسی کنید.`);
      $("files").innerHTML = '<div class="empty">کتابخانه بارگذاری نشد.</div>';
    }
  }
  async function loadAdmins() {
    try {
      const data = await api("/api/admins");
      $("adminsList").innerHTML = (data.admins||[]).map(a => `
        <div class="adminrow"><span><b>${escapeHtml(a.role)}</b> · <code>${escapeHtml(a.telegram_id)}</code></span>
        ${a.role === "ADMIN" ? `<button data-remove="${escapeHtml(a.telegram_id)}">حذف</button>` : ""}</div>`).join("") || "<p>ادمینی ثبت نشده است.</p>";
    } catch(e) { $("adminsList").textContent = `دریافت ادمین‌ها ناموفق بود: ${e.message}`; }
  }
  async function loadAudit() {
    try {
      const data = await api("/api/audit");
      $("auditList").innerHTML = (data.events||[]).map(e => `<div class="auditrow">${escapeHtml(e.created_at)} · ${escapeHtml(e.action)} · ${escapeHtml(e.actor_telegram_id)} · ${escapeHtml(e.target_id)}</div>`).join("");
    } catch(e) { $("auditList").textContent = `دریافت تاریخچه ناموفق بود: ${e.message}`; }
  }
  async function boot() {
    if (!initData) {
      showNotice("برای امنیت، این اپ باید از دکمه Open داخل تلگرام باز شود؛ باز کردن مستقیم در مرورگر معمولی ورود را تأیید نمی‌کند.");
      $("files").innerHTML = '<div class="empty">Telegram Mini App authentication required.</div>';
      return;
    }
    try {
      const data = await api("/api/me");
      me = data;
      $("welcome").textContent = `خوش آمدی ${data.user.first_name || ""} · کتابخانه فایل‌های تأییدشده`;
      if (data.role === "OWNER") {
        $("adminPanel").classList.remove("hidden");
        $("auditPanel").classList.remove("hidden");
        await Promise.all([loadAdmins(),loadAudit()]);
      }
      await loadFiles();
    } catch(e) {
      showNotice(e.message === "GROUP_MEMBERSHIP_REQUIRED" ? "برای استفاده از کتابخانه باید عضو گروه مجاز باشید." : `ورود ناموفق بود: ${e.message}`);
    }
  }
  $("files").addEventListener("click", async e => {
    const link = e.target.closest("[data-download]");
    if (!link) return;
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/file/${encodeURIComponent(link.dataset.download)}`, {headers:{"X-Telegram-Init-Data":initData}});
      if (!response.ok) throw new Error(response.status === 403 ? "GROUP_MEMBERSHIP_REQUIRED" : "DOWNLOAD_FAILED");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = link.closest(".file").querySelector("h3").textContent.replace(/^📄\\s*/,"") || "study-file";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(objectUrl), 30000);
    } catch(err) { showNotice(err.message === "GROUP_MEMBERSHIP_REQUIRED" ? "عضویت در گروه تأیید نشد." : "دریافت فایل انجام نشد. اپ را از داخل تلگرام باز کنید."); }
  });
  $("searchBtn").addEventListener("click", loadFiles);
  $("refresh").addEventListener("click", () => {loadFiles(); if(me?.role==="OWNER"){loadAdmins();loadAudit();}});
  $("q").addEventListener("keydown", e => {if(e.key==="Enter")loadFiles();});
  $("addAdminForm").addEventListener("submit", async e => {
    e.preventDefault();
    const id = $("adminId").value.trim();
    try { await api("/api/admins",{method:"POST",body:JSON.stringify({telegram_id:id})}); $("adminId").value=""; await loadAdmins(); showNotice("ادمین اضافه شد. او باید ربات را در گفت‌وگوی خصوصی Start کند تا اعلان دریافت کند."); }
    catch(err){showNotice(`افزودن ادمین انجام نشد: ${err.message}`);}
  });
  $("adminsList").addEventListener("click", async e => {
    const id = e.target?.dataset?.remove;
    if(!id) return;
    if(!confirm(`ادمین ${id} حذف شود؟`)) return;
    try {await api(`/api/admins/${encodeURIComponent(id)}`,{method:"DELETE"});await loadAdmins();showNotice("دسترسی ادمین حذف شد.");}
    catch(err){showNotice(`حذف انجام نشد: ${err.message}`);}
  });
  boot();
})();
