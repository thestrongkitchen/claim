/* The Strong Kitchen — first-month bonuses pages
   - Carries utm_* / gclid / fbclid from this page onto every thestrongkitchen.com link (keeps attribution across the hop)
   - Capture form: Connecticut check (all CT zips start with 06) → subscribe to Klaviyo list via the public client API → thank-you page
*/
(function () {
  var KLAVIYO_COMPANY = 'RHx7TH';          // public key
  var KLAVIYO_LIST = 'Tg6vZf';             // "First-Month Bonuses — Signups" (triggers the nurture flow)
  var NEWSLETTER_LIST = 'Upt57m';          // "Newsletter" — Luke's Monday menu + Wednesday reminder audience (CT signups only)
  var MENU_URL = 'https://thestrongkitchen.com/menus';

  // ---- attribution carry-over -------------------------------------------
  var params = new URLSearchParams(location.search);
  var carry = {};
  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid'].forEach(function (k) {
    if (params.get(k)) carry[k] = params.get(k);
  });
  if (!carry.utm_source) { carry.utm_source = 'claim-lp'; carry.utm_medium = 'referral'; carry.utm_campaign = 'first-month-bonuses'; }
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

    var props = { zip_code: zip, is_connecticut: isCT, lead_source: 'first-month-bonuses-lp', signup_page: location.pathname };
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
      // Connecticut signups also join the main Newsletter list (Monday menu + Wednesday reminder). Out-of-state stays off it.
      if (isCT) {
        var nl = JSON.parse(JSON.stringify(body));
        nl.data.relationships.list.data.id = NEWSLETTER_LIST;
        fetch('https://a.klaviyo.com/client/subscriptions/?company_id=' + KLAVIYO_COMPANY, {
          method: 'POST', headers: { 'Content-Type': 'application/vnd.api+json', 'revision': '2024-10-15' }, body: JSON.stringify(nl)
        }).catch(function () {});
      }
      try { if (window.dataLayer) window.dataLayer.push({ event: 'generate_lead', lead_is_ct: isCT, lead_zip: zip }); } catch (e) {}
      var next = new URL('thanks.html', location.href);
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
