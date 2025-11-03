# Production Launch Checklist

This checklist ensures your app is ready for public release.

---

## Pre-Launch Checklist

### Authentication & Security
- [ ] **Enable email confirmation** in Supabase
  - Go to: Supabase Dashboard → Authentication → Settings
  - Toggle "Confirm email" to ON
  - Test email delivery works
- [ ] Verify password reset flow works
- [ ] Test all authentication flows
- [ ] Review security settings

### App Store / Play Store
- [ ] Complete store listings (screenshots, descriptions)
- [ ] Privacy policy URL added and working
- [ ] Terms of service URL added
- [ ] Content ratings completed
- [ ] Data safety forms filled out
- [ ] App icon and assets finalized

### Testing
- [ ] Beta testing completed
- [ ] All critical bugs fixed
- [ ] Performance optimized
- [ ] Tested on multiple devices
- [ ] Tested on different OS versions

### Analytics
- [ ] PostHog tracking verified
- [ ] Key metrics dashboard created
- [ ] Error tracking configured (if using Sentry)

### Legal & Compliance
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] GDPR compliance (if applicable)
- [ ] Data collection disclosures

---

## Quick Toggle: Email Confirmation

**Current (Beta):** Email confirmation OFF ✅
**Production:** Email confirmation ON ⚠️

**To enable before launch:**
1. Supabase Dashboard → Authentication → Settings
2. Toggle "Confirm email" ON
3. Test email delivery
4. Update app store listing if needed

---

## Notes

- Email confirmation can be toggled anytime in Supabase
- No code changes needed - it's just a Supabase setting
- Test thoroughly after enabling

