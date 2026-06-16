const LANG = {
  en: {
    // Sidebar
    sidebar_title: 'CF OIDC',
    nav_users: 'Users',
    nav_clients: 'Clients',
    nav_branding: 'Login Page',
    nav_login_codes: 'Login Codes',
    nav_logs: 'Logs',
    nav_logout: 'Logout',
    nav_login_codes_disabled: 'Enable login codes in Login Page settings first.',
    // Login page
    login_title: 'OIDC Admin',
    login_subtitle: 'Enter admin password to continue',
    login_password_label: 'Password',
    login_password_placeholder: 'Admin password',
    login_btn: 'Sign In',
    login_error: 'Login failed',
    // Users
    users_title: 'Registered Users',
    users_th_email: 'Email',
    users_th_domain: 'Domain',
    users_th_sub: 'Sub (ID)',
    users_th_created: 'Created',
    users_th_last_login: 'Last Login',
    users_th_actions: 'Actions',
    users_empty: 'No registered users yet.',
    users_confirm: 'Delete user',
    users_deleted: 'User deleted',
    // Clients
    clients_title: 'OIDC Clients',
    clients_create_title: 'Create New Client',
    clients_name_label: 'Client Name',
    clients_name_placeholder: 'e.g. ChatGPT SSO',
    clients_uris_label: 'Redirect URI',
    clients_create_btn: 'Create Client',
    clients_success_title: 'Client Created Successfully',
    clients_success_desc: "Save the client secret now — it won't be shown again.",
    clients_id_label: 'Client ID',
    clients_secret_label: 'Client Secret',
    clients_dismiss: 'Dismiss',
    clients_registered: 'Registered Clients',
    clients_th_name: 'Name',
    clients_th_id: 'Client ID',
    clients_th_uris: 'Redirect URI',
    clients_th_created: 'Created',
    clients_th_actions: 'Actions',
    clients_empty: 'No OIDC clients configured.',
    clients_name_required: 'Name is required',
    clients_confirm: 'Delete this client?',
    clients_deleted: 'Client deleted',
    clients_copied: 'Copied!',
    clients_th_domains: 'Allowed Domains',
    clients_domains_label: 'Allowed Email Domains (one per line)',
    clients_domains_placeholder: 'example.com',
    clients_domains_empty: 'No domains — all emails blocked',
    clients_domains_saved: 'Domains updated',
    // Login codes
    login_codes_title: 'Login Verification Codes',
    login_codes_create_title: 'Create Login Code',
    login_codes_code_label: 'Verification Code',
    login_codes_code_placeholder: 'Leave blank to auto-generate',
    login_codes_auto_hint: 'Leave this empty and the system will generate a random code.',
    login_codes_max_uses_label: 'Usage Limit',
    login_codes_max_uses_placeholder: 'e.g. 5',
    login_codes_unlimited: 'Unlimited',
    login_codes_create_btn: 'Add Code',
    login_codes_security_title: 'Login Security',
    login_codes_global_note: 'These settings apply to all OIDC clients.',
    login_codes_login_code_toggle: 'Require Login Code',
    login_codes_login_code_desc: 'Users must enter a managed verification code on the login page.',
    login_codes_turnstile_toggle: 'Require Turnstile',
    login_codes_turnstile_desc: 'Cloudflare Turnstile is enforced when the site key and secret are configured.',
    login_codes_security_saved: 'Security settings saved',
    login_codes_registered: 'Active Login Codes',
    login_codes_th_code: 'Code',
    login_codes_th_usage: 'Usage',
    login_codes_th_created: 'Created',
    login_codes_th_actions: 'Actions',
    login_codes_empty: 'No login codes configured.',
    login_codes_added: 'Login code added',
    login_codes_deleted: 'Login code deleted',
    login_codes_confirm: 'Delete this login code?',
    login_codes_bad_limit: 'Usage limit must be a positive number or unlimited',
    login_codes_copied: 'Code copied',
    login_codes_copy: 'Copy code',
    login_codes_legacy_hidden: 'Legacy hidden code',
    login_codes_exhausted: 'Exhausted',
    // Branding
    branding_title: 'Login Page Branding',
    branding_org_title: 'Organization Title',
    branding_icon_url: 'Organization Icon URL',
    branding_icon_hint: '(displayed left of title)',
    branding_bg_url: 'Background Image URL',
    branding_bg_hint: '(overrides theme default background)',
    branding_bg_rotate: 'Random Rotation',
    branding_bg_rotate_placeholder: 'One image URL per line, randomly displayed each time',
    branding_links_title: 'External Links',
    branding_links_hint: 'Show centered icon links below the login button.',
    branding_links_empty: 'No external links yet.',
    branding_add_link: 'Add Link',
    branding_link_item: 'Link',
    branding_link_name: 'Link Name',
    branding_link_icon_url: 'Icon URL',
    branding_link_url: 'Redirect URL',
    branding_save: 'Save Changes',
    branding_login_code_toggle: 'Login Code',
    branding_turnstile_toggle: 'Turnstile',
    branding_turnstile_unconfigured: 'Turnstile ENV is not configured',
    branding_theme: 'Theme',
    branding_theme_hint: '— click to select',
    branding_active: 'Active',
    branding_saved: 'Branding saved',
    branding_settings: 'Settings',
    branding_back_preview: 'Preview',
    theme_gradient_start: 'Gradient Start',
    theme_gradient_end: 'Gradient End',
    theme_btn_color: 'Theme Color',
    theme_auto: 'Auto',
    theme_bg_color: 'Background',
    theme_opacity: 'Transparency',
    theme_blur: 'Blur',
    theme_color1: 'Color 1',
    theme_color2: 'Color 2',
    theme_color3: 'Color 3',
    theme_gradient: 'Gradient',
    theme_border_width: 'Border Width',
    theme_border_radius: 'Border Radius',
    // Logs
    logs_title: 'Activity Logs',
    logs_filter_placeholder: 'Filter by action, email, or IP...',
    logs_refresh: 'Refresh',
    logs_th_time: 'Time',
    logs_th_action: 'Action',
    logs_th_email: 'Email',
    logs_th_client: 'Client',
    logs_th_ip: 'IP',
    logs_empty: 'No activity logs yet.',
    // Login card (authorize)
    auth_subtitle: 'Enter your email to continue',
    auth_email_label: 'Email Address',
    auth_email_placeholder: 'you@company.com',
    auth_given_name: 'First Name',
    auth_family_name: 'Last Name',
    auth_btn: 'Continue',
    // Common
    delete_btn: 'Delete',
  },
  zh: {
    sidebar_title: 'CF OIDC',
    nav_users: '用戶管理',
    nav_clients: '用戶端管理',
    nav_branding: '登入頁設定',
    nav_login_codes: '登入驗證碼',
    nav_logs: '操作日誌',
    nav_logout: '登出',
    nav_login_codes_disabled: '請先在「登入頁設定」開啟登入驗證碼。',
    login_title: 'OIDC 管理後台',
    login_subtitle: '請輸入管理員密碼',
    login_password_label: '密碼',
    login_password_placeholder: '管理員密碼',
    login_btn: '登入',
    login_error: '登入失敗',
    users_title: '已註冊用戶',
    users_th_email: '信箱',
    users_th_domain: '域名',
    users_th_sub: '用戶 ID',
    users_th_created: '建立時間',
    users_th_last_login: '最後登入',
    users_th_actions: '操作',
    users_empty: '尚無已註冊用戶。',
    users_confirm: '確定要刪除用戶',
    users_deleted: '用戶已刪除',
    clients_title: 'OIDC 用戶端',
    clients_create_title: '建立新用戶端',
    clients_name_label: '用戶端名稱',
    clients_name_placeholder: '例如 ChatGPT SSO',
    clients_uris_label: '回調網址',
    clients_create_btn: '建立用戶端',
    clients_success_title: '用戶端建立成功',
    clients_success_desc: '請立即儲存 Client Secret，之後將無法再次查看。',
    clients_id_label: 'Client ID',
    clients_secret_label: 'Client Secret',
    clients_dismiss: '關閉',
    clients_registered: '已註冊的用戶端',
    clients_th_name: '名稱',
    clients_th_id: 'Client ID',
    clients_th_uris: '回調網址',
    clients_th_created: '建立時間',
    clients_th_actions: '操作',
    clients_empty: '尚無 OIDC 用戶端。',
    clients_name_required: '名稱為必填',
    clients_confirm: '確定要刪除此用戶端？',
    clients_deleted: '用戶端已刪除',
    clients_copied: '已複製！',
    clients_th_domains: '允許域名',
    clients_domains_label: '允許的信箱域名（每行一個）',
    clients_domains_placeholder: 'example.com',
    clients_domains_empty: '未設定域名 — 所有信箱均無法登入',
    clients_domains_saved: '域名已更新',
    login_codes_title: '登入驗證碼',
    login_codes_create_title: '建立登入驗證碼',
    login_codes_code_label: '驗證碼',
    login_codes_code_placeholder: '留空會自動產生',
    login_codes_auto_hint: '不輸入驗證碼時，系統會自動產生一組隨機碼。',
    login_codes_max_uses_label: '使用次數限制',
    login_codes_max_uses_placeholder: '例如 5',
    login_codes_unlimited: '無限次',
    login_codes_create_btn: '新增驗證碼',
    login_codes_security_title: '登入安全',
    login_codes_global_note: '這些設定會套用到所有 OIDC 用戶端。',
    login_codes_login_code_toggle: '要求登入驗證碼',
    login_codes_login_code_desc: '使用者登入時必須輸入後台建立的驗證碼。',
    login_codes_turnstile_toggle: '要求 Turnstile',
    login_codes_turnstile_desc: '已設定 Site Key 與 Secret 時，登入頁會啟用 Cloudflare Turnstile。',
    login_codes_security_saved: '安全設定已儲存',
    login_codes_registered: '啟用中的登入驗證碼',
    login_codes_th_code: '驗證碼',
    login_codes_th_usage: '使用次數',
    login_codes_th_created: '建立時間',
    login_codes_th_actions: '操作',
    login_codes_empty: '尚未設定登入驗證碼。',
    login_codes_added: '登入驗證碼已新增',
    login_codes_deleted: '登入驗證碼已刪除',
    login_codes_confirm: '確定要刪除此登入驗證碼？',
    login_codes_bad_limit: '使用次數限制必須是正整數或無限次',
    login_codes_copied: '驗證碼已複製',
    login_codes_copy: '複製驗證碼',
    login_codes_legacy_hidden: '舊版隱藏驗證碼',
    login_codes_exhausted: '已用完',
    branding_title: '登入頁外觀',
    branding_org_title: '組織名稱',
    branding_icon_url: '組織 Icon 網址',
    branding_icon_hint: '（顯示在標題左側）',
    branding_bg_url: '背景圖片網址',
    branding_bg_hint: '（會覆蓋主題預設背景）',
    branding_bg_rotate: '隨機輪換圖片',
    branding_bg_rotate_placeholder: '一行一個圖片網址，每次隨機顯示',
    branding_links_title: '外部跳轉',
    branding_links_hint: '會顯示在登入頁繼續按鈕下方，置中排列為圓形圖示連結。',
    branding_links_empty: '尚未設定外部跳轉。',
    branding_add_link: '新增連結',
    branding_link_item: '連結',
    branding_link_name: '連結名稱',
    branding_link_icon_url: 'ICON 網址',
    branding_link_url: '跳轉網址',
    branding_save: '儲存設定',
    branding_login_code_toggle: '登入驗證碼',
    branding_turnstile_toggle: 'turnstile',
    branding_turnstile_unconfigured: '尚未設定 Turnstile ENV',
    branding_theme: '主題',
    branding_theme_hint: '— 點擊選擇',
    branding_active: '使用中',
    branding_saved: '設定已儲存',
    branding_settings: '設定',
    branding_back_preview: '預覽',
    theme_gradient_start: '漸層起始色',
    theme_gradient_end: '漸層結束色',
    theme_btn_color: '主題色',
    theme_auto: '自動',
    theme_bg_color: '背景色',
    theme_opacity: '透明度',
    theme_blur: '模糊度',
    theme_color1: '色彩 1',
    theme_color2: '色彩 2',
    theme_color3: '色彩 3',
    theme_gradient: '漸層效果',
    theme_border_width: '邊框寬度',
    theme_border_radius: '圓角',
    logs_title: '操作日誌',
    logs_filter_placeholder: '依操作、信箱或 IP 篩選...',
    logs_refresh: '重新整理',
    logs_th_time: '時間',
    logs_th_action: '操作',
    logs_th_email: '信箱',
    logs_th_client: '用戶端',
    logs_th_ip: 'IP',
    logs_empty: '尚無操作日誌。',
    auth_subtitle: '請輸入您的電子信箱以繼續',
    auth_email_label: '電子信箱',
    auth_email_placeholder: 'you@company.com',
    auth_given_name: '名字',
    auth_family_name: '姓氏',
    auth_btn: '繼續',
    delete_btn: '刪除',
  },
  zh_cn: {
    sidebar_title: 'CF OIDC',
    nav_users: '用户管理',
    nav_clients: '客户端管理',
    nav_branding: '登录页设定',
    nav_login_codes: '登录验证码',
    nav_logs: '操作日志',
    nav_logout: '登出',
    nav_login_codes_disabled: '请先在「登录页设定」开启登录验证码。',
    login_title: 'OIDC 管理后台',
    login_subtitle: '请输入管理员密码',
    login_password_label: '密码',
    login_password_placeholder: '管理员密码',
    login_btn: '登录',
    login_error: '登录失败',
    users_title: '已注册用户',
    users_th_email: '邮箱',
    users_th_domain: '域名',
    users_th_sub: '用户 ID',
    users_th_created: '创建时间',
    users_th_last_login: '最后登录',
    users_th_actions: '操作',
    users_empty: '暂无已注册用户。',
    users_confirm: '确定要删除用户',
    users_deleted: '用户已删除',
    clients_title: 'OIDC 客户端',
    clients_create_title: '创建新客户端',
    clients_name_label: '客户端名称',
    clients_name_placeholder: '例如 ChatGPT SSO',
    clients_uris_label: '回调网址',
    clients_create_btn: '创建客户端',
    clients_success_title: '客户端创建成功',
    clients_success_desc: '请立即保存 Client Secret，之后将无法再次查看。',
    clients_id_label: 'Client ID',
    clients_secret_label: 'Client Secret',
    clients_dismiss: '关闭',
    clients_registered: '已注册的客户端',
    clients_th_name: '名称',
    clients_th_id: 'Client ID',
    clients_th_uris: '回调网址',
    clients_th_created: '创建时间',
    clients_th_actions: '操作',
    clients_empty: '暂无 OIDC 客户端。',
    clients_name_required: '名称为必填',
    clients_confirm: '确定要删除此客户端？',
    clients_deleted: '客户端已删除',
    clients_copied: '已复制！',
    clients_th_domains: '允许域名',
    clients_domains_label: '允许的邮箱域名（每行一个）',
    clients_domains_placeholder: 'example.com',
    clients_domains_empty: '未设定域名 — 所有邮箱均无法登录',
    clients_domains_saved: '域名已更新',
    login_codes_title: '登录验证码',
    login_codes_create_title: '创建登录验证码',
    login_codes_code_label: '验证码',
    login_codes_code_placeholder: '留空会自动生成',
    login_codes_auto_hint: '不输入验证码时，系统会自动生成一组随机码。',
    login_codes_max_uses_label: '使用次数限制',
    login_codes_max_uses_placeholder: '例如 5',
    login_codes_unlimited: '无限次',
    login_codes_create_btn: '添加验证码',
    login_codes_security_title: '登录安全',
    login_codes_global_note: '这些设定会应用到所有 OIDC 客户端。',
    login_codes_login_code_toggle: '要求登录验证码',
    login_codes_login_code_desc: '用户登录时必须输入后台创建的验证码。',
    login_codes_turnstile_toggle: '要求 Turnstile',
    login_codes_turnstile_desc: '已设定 Site Key 与 Secret 时，登录页会启用 Cloudflare Turnstile。',
    login_codes_security_saved: '安全设定已保存',
    login_codes_registered: '启用中的登录验证码',
    login_codes_th_code: '验证码',
    login_codes_th_usage: '使用次数',
    login_codes_th_created: '创建时间',
    login_codes_th_actions: '操作',
    login_codes_empty: '尚未设定登录验证码。',
    login_codes_added: '登录验证码已添加',
    login_codes_deleted: '登录验证码已删除',
    login_codes_confirm: '确定要删除此登录验证码？',
    login_codes_bad_limit: '使用次数限制必须是正整数或无限次',
    login_codes_copied: '验证码已复制',
    login_codes_copy: '复制验证码',
    login_codes_legacy_hidden: '旧版隐藏验证码',
    login_codes_exhausted: '已用完',
    branding_title: '登录页外观',
    branding_org_title: '组织名称',
    branding_icon_url: '组织 Icon 网址',
    branding_icon_hint: '（显示在标题左侧）',
    branding_bg_url: '背景图片网址',
    branding_bg_hint: '（会覆盖主题默认背景）',
    branding_bg_rotate: '随机轮换图片',
    branding_bg_rotate_placeholder: '一行一个图片网址，每次随机显示',
    branding_links_title: '外部跳转',
    branding_links_hint: '会显示在登录页继续按钮下方，居中排列为圆形图标链接。',
    branding_links_empty: '尚未设定外部跳转。',
    branding_add_link: '添加链接',
    branding_link_item: '链接',
    branding_link_name: '链接名称',
    branding_link_icon_url: 'ICON 网址',
    branding_link_url: '跳转网址',
    branding_save: '保存设定',
    branding_login_code_toggle: '登录验证码',
    branding_turnstile_toggle: 'turnstile',
    branding_turnstile_unconfigured: '尚未设定 Turnstile ENV',
    branding_theme: '主题',
    branding_theme_hint: '— 点击选择',
    branding_active: '使用中',
    branding_saved: '设定已保存',
    branding_settings: '设定',
    branding_back_preview: '预览',
    theme_gradient_start: '渐变起始色',
    theme_gradient_end: '渐变结束色',
    theme_btn_color: '主题色',
    theme_auto: '自动',
    theme_bg_color: '背景色',
    theme_opacity: '透明度',
    theme_blur: '模糊度',
    theme_color1: '色彩 1',
    theme_color2: '色彩 2',
    theme_color3: '色彩 3',
    theme_gradient: '渐变效果',
    theme_border_width: '边框宽度',
    theme_border_radius: '圆角',
    logs_title: '操作日志',
    logs_filter_placeholder: '按操作、邮箱或 IP 筛选...',
    logs_refresh: '刷新',
    logs_th_time: '时间',
    logs_th_action: '操作',
    logs_th_email: '邮箱',
    logs_th_client: '客户端',
    logs_th_ip: 'IP',
    logs_empty: '暂无操作日志。',
    auth_subtitle: '请输入您的电子邮箱以继续',
    auth_email_label: '电子邮箱',
    auth_email_placeholder: 'you@company.com',
    auth_given_name: '名字',
    auth_family_name: '姓氏',
    auth_btn: '继续',
    delete_btn: '删除',
  },
};

function getLang() {
  return localStorage.getItem('admin_lang') || 'en';
}

function setLang(lang) {
  localStorage.setItem('admin_lang', lang);
  location.reload();
}

function t(key) {
  const lang = getLang();
  return (LANG[lang] && LANG[lang][key]) || LANG.en[key] || key;
}

function renderLangSwitch() {
  const lang = getLang();
  const langs = [
    { key: 'en', label: 'EN' },
    { key: 'zh', label: '繁中' },
    { key: 'zh_cn', label: '简中' },
  ];
  const wrap = document.createElement('div');
  wrap.style.cssText = 'padding:12px 20px;margin-top:auto;border-top:1px solid rgba(255,255,255,0.15)';
  wrap.innerHTML = '<div style="display:flex;gap:4px">' + langs.map(function(l) {
    var a = lang === l.key;
    return '<button onclick="setLang(\'' + l.key + '\')" style="flex:1;background:rgba(255,255,255,' + (a ? '0.22' : '0.08') + ');border:1px solid rgba(255,255,255,' + (a ? '0.35' : '0.15') + ');border-radius:6px;padding:7px 4px;color:rgba(255,255,255,' + (a ? '1' : '0.6') + ');cursor:pointer;font-size:12px;font-weight:' + (a ? '600' : '500') + ';transition:all .2s">' + l.label + '</button>';
  }).join('') + '</div>' +
    '<a href="https://github.com/banana2556" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:5px;margin-top:10px;color:rgba(255,255,255,0.35);font-size:11px;text-decoration:none;transition:color .2s" onmouseover="this.style.color=\'rgba(255,255,255,0.7)\'" onmouseout="this.style.color=\'rgba(255,255,255,0.35)\'"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>@banana2556</a>';
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.appendChild(wrap);
}

function renderSidebar(active, opts) {
  var sc = window.__SITE_CONFIG || {};
  var logoUrl = sc.logo_url || '/favicon.png';
  var siteName = sc.site_name || t('sidebar_title');
  if (sc.logo_url) {
    var link = document.querySelector('link[rel="icon"]');
    if (link) link.href = sc.logo_url;
  }
  var loginCodeEnabled = opts && opts.loginCodeEnabled !== undefined ? opts.loginCodeEnabled : true;
  var sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  var lcClass = loginCodeEnabled ? '' : ' disabled';
  var lcClick = loginCodeEnabled ? '' : ' onclick="event.preventDefault();alert(t(\'nav_login_codes_disabled\'))"';
  sidebar.innerHTML = `
    <h2><a href="https://github.com/banana2556/oidc-worker" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none"><img src="${logoUrl}" alt="" width="22" height="22">${siteName}</a></h2>
    <a href="/admin/clients.html" ${active==='clients'?'class="active"':''}>${t('nav_clients')}</a>
    <a href="/admin/users.html" ${active==='users'?'class="active"':''}>${t('nav_users')}</a>
    <a href="/admin/branding.html" ${active==='branding'?'class="active"':''}>${t('nav_branding')}</a>
    <a href="/admin/login-codes.html" class="${active==='login-codes'?'active':''}${lcClass}"${lcClick}>${t('nav_login_codes')}</a>
    <a href="/admin/logs.html" ${active==='logs'?'class="active"':''}>${t('nav_logs')}</a>
    <a href="#" onclick="logout()" style="color:rgba(255,200,200,0.9)">${t('nav_logout')}</a>
  `;
  renderLangSwitch();
}

function createPager(name, containerId, renderFn, pageSize) {
  var autoFit = pageSize === 'auto';
  var pager = { page: 1, pageSize: autoFit ? 10 : (pageSize || 20), data: [] };
  window._pagers = window._pagers || {};
  window._pagers[name] = pager;

  pager.calcFit = function() {
    var el = document.getElementById(containerId);
    if (!el) return;
    var card = el.closest('.card');
    if (!card) return;
    var thead = card.querySelector('thead');
    if (!thead) return;
    var vh = window.innerHeight;
    var top = thead.getBoundingClientRect().bottom;
    var available = vh - top - 70;
    var rowH = 45;
    var row = card.querySelector('tbody tr');
    if (row) rowH = Math.max(row.offsetHeight, 30);
    pager.pageSize = Math.max(3, Math.floor(available / rowH));
  };

  pager.setData = function(data) {
    pager.data = data || [];
    pager.page = 1;
    if (autoFit) pager.calcFit();
    pager.refresh();
  };

  pager.refresh = function() {
    var total = pager.data.length;
    var totalPages = Math.max(1, Math.ceil(total / pager.pageSize));
    if (pager.page > totalPages) pager.page = totalPages;
    if (pager.page < 1) pager.page = 1;
    var start = (pager.page - 1) * pager.pageSize;
    renderFn(total === 0 ? [] : pager.data.slice(start, start + pager.pageSize), total);

    var el = document.getElementById(containerId);
    if (!el) return;
    if (total <= pager.pageSize) { el.innerHTML = ''; return; }
    var s = start + 1;
    var e = Math.min(start + pager.pageSize, total);
    el.innerHTML = '<div class="pager">' +
      '<span class="pager-info">' + s + ' – ' + e + ' / ' + total + '</span>' +
      '<div class="pager-btns">' +
        '<button class="pager-btn"' + (pager.page <= 1 ? ' disabled' : '') +
        ' onclick="window._pagers[\'' + name + '\'].page--;window._pagers[\'' + name + '\'].refresh()">‹</button>' +
        '<span class="pager-current">' + pager.page + ' / ' + totalPages + '</span>' +
        '<button class="pager-btn"' + (pager.page >= totalPages ? ' disabled' : '') +
        ' onclick="window._pagers[\'' + name + '\'].page++;window._pagers[\'' + name + '\'].refresh()">›</button>' +
      '</div></div>';
  };

  if (autoFit) {
    var resizeTimer;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        pager.calcFit();
        pager.refresh();
      }, 150);
    });
  }

  return pager;
}
