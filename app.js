/* The Strong Kitchen — first-month bonuses pages
   - Carries utm_* / gclid / fbclid from this page onto every thestrongkitchen.com link (keeps attribution across the hop)
   - Capture form: Connecticut check (all CT zips start with 06) → subscribe to Klaviyo list via the public client API → thank-you page
*/
(function () {
  var KLAVIYO_COMPANY = 'RHx7TH';          // public key
  var KLAVIYO_LIST = 'Tg6vZf';             // "First-Month Bonuses — Signups" (triggers the nurture flow)
  var MENU_URL = 'https://thestrongkitchen.com/menus';

  // ---- attribution carry-over -------------------------------------------
  var params = new URLSearchParams(location.search);
  var carry = {};
  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid'].forEach(function (k) {
    if (params.get(k)) carry[k] = params.get(k);
  });
  // A page may override its own labels (window.TSK_LP, set before this script) so
  // separate ad destinations stay distinguishable in GA4. Claim-page defaults unchanged.
  var LP = window.TSK_LP || {};
  if (!carry.utm_source) {
    if (carry.gclid) { carry.utm_source = 'google'; carry.utm_medium = 'cpc'; carry.utm_campaign = LP.campaign || 'search-sk-insider-claim'; }
    else if (carry.fbclid) { carry.utm_source = 'facebook'; carry.utm_medium = 'paid-social'; carry.utm_campaign = LP.campaign || 'first-month-bonuses'; }
    else { carry.utm_source = LP.fallbackSource || 'claim-lp'; carry.utm_medium = 'referral'; carry.utm_campaign = LP.campaign || 'first-month-bonuses'; }
  }
  function withCarry(url) {
    var u = new URL(url, location.href);
    Object.keys(carry).forEach(function (k) { if (!u.searchParams.get(k)) u.searchParams.set(k, carry[k]); });
    return u.toString();
  }
  document.querySelectorAll('a[data-menu]').forEach(function (a) { a.href = withCarry(MENU_URL); });
  document.querySelectorAll('a[data-carry]').forEach(function (a) { a.href = withCarry(a.getAttribute('href')); });

  // ---- capture form -------------------------------------------------------
  var form = document.getElementById('claim-form');
  if (!form) return;
  var msg = document.getElementById('form-msg');
  var btn = form.querySelector('button[type=submit]');

  function show(kind, text) { msg.className = 'msg ' + kind; msg.textContent = text; }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (form.website && form.website.value) return;            // honeypot
    var email = form.email.value.trim();
    var zip = form.zip.value.trim().replace(/[^0-9]/g, '').slice(0, 5);
    var first = form.first_name ? form.first_name.value.trim() : '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return show('err', 'That email doesn’t look right — give it another look.');
    if (zip.length !== 5) return show('err', 'Enter your 5-digit zip so we only send you what we actually deliver.');
    var isCT = zip.indexOf('06') === 0;

    var props = { zip_code: zip, is_connecticut: isCT, lead_source: LP.leadSource || 'first-month-bonuses-lp', signup_page: location.pathname, sk_insider_claim: true };
    Object.keys(carry).forEach(function (k) { props[k] = carry[k]; });

    var body = { data: { type: 'subscription', attributes: {
      custom_source: 'First-Month Bonuses LP',
      profile: { data: { type: 'profile', attributes: {
        email: email,
        first_name: first || undefined,
        location: { zip: zip, country: 'US' },
        properties: props
      } } }
    }, relationships: { list: { data: { type: 'list', id: KLAVIYO_LIST } } } } };

    btn.disabled = true; show('ok', 'One sec…');
    fetch('https://a.klaviyo.com/client/subscriptions/?company_id=' + KLAVIYO_COMPANY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/vnd.api+json', 'revision': '2024-10-15' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok && r.status !== 202) throw new Error('status ' + r.status);
      // Newsletter hand-off happens in Klaviyo (end of nurture flow, or on first purchase) — not here. Luke 8/22.
      try { if (window.dataLayer) window.dataLayer.push({ event: 'generate_lead', lead_is_ct: isCT, lead_zip: zip }); } catch (e) {}
      var next = new URL(LP.thanksPage || 'thanks.html', location.href);
      next.searchParams.set('ct', isCT ? '1' : '0');
      if (first) next.searchParams.set('n', first);
      Object.keys(carry).forEach(function (k) { next.searchParams.set(k, carry[k]); });
      location.href = next.toString();
    }).catch(function () {
      btn.disabled = false;
      show('err', 'Something went wrong on our end. Email luke@thestrongkitchen.com and we’ll sort it out by hand.');
    });
  });
})();
