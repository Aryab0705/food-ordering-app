# Deployment Guide

## Backend (Render)

### Required Environment Variables

Add these to your Render dashboard for the `food-ordering-backend` service:

#### Database & Auth
```
MONGODB_URI=mongodb+srv://<your-atlas-connection-string>
JWT_SECRET=your_strong_secret_key
PORT=5000
```

#### Email (Resend) - Required for OTP
```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM=Campus Canteen Hub <noreply@yourdomain.com>
```

**Important:** `RESEND_FROM` must use a domain verified in Resend. The resend.dev sandbox sender only sends to your Resend account email. To send OTPs to any user, verify a domain at https://resend.com/domains.

#### Payment (Razorpay)
```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx
```

#### Frontend URL (for CORS)
```
CLIENT_URL=https://campus-canteen-hub.vercel.app
```

#### SMS (Twilio) - Optional
```
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
```

### Removed Variables
The following are no longer needed (Gmail SMTP has IPv6 issues on Render):
- `SMTP_HOST` (remove if present)
- `SMTP_PORT` (remove if present)
- `SMTP_SECURE` (remove if present)
- `SMTP_USER` (remove if present)
- `SMTP_PASS` (remove if present)
- `SMTP_FROM` (remove if present)

## Frontend (Vercel)

### Environment Variables (Optional)
The frontend uses a fallback URL in `src/api/client.js`:
- Local: `http://localhost:5000`
- Production: `https://food-ordering-backend-g9ff.onrender.com`

If you need to override, add to Vercel:
```
VITE_API_URL=https://food-ordering-backend-g9ff.onrender.com/api
```

## Troubleshooting

### OTP Not Working on Deployed Site
1. Check Render logs for Resend errors
2. Verify `RESEND_API_KEY` and `RESEND_FROM` are set in Render
3. Ensure `RESEND_FROM` uses a domain verified in Resend (not resend.dev)
4. Check email spam folder
5. Verify Render backend URL is correct in frontend

### CORS Errors
1. Verify `CLIENT_URL` matches your Vercel domain
2. Check `ALLOWED_ORIGINS` in `server/src/app.js`
3. Ensure backend is deployed and accessible

### Server Timeout
- Email sending is non-blocking (fire-and-forget)
- Login responds immediately
- Email sends in background via Resend API

### Why Resend Instead of Gmail SMTP?
Gmail SMTP has known issues on cloud platforms like Render:
- IPv6 connection failures (ENETUNREACH)
- Port blocking (465/587) on free-tier firewalls
- Slow connection timeouts

Resend uses HTTPS (port 443) which:
- Works on all cloud platforms
- Never firewalled
- No IPv6 issues
- Faster and more reliable
