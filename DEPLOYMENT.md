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

#### Email (Gmail SMTP) - Required for OTP
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=your_gmail_app_password
SMTP_FROM=Campus Canteen Hub <your@gmail.com>
```

**Note:** Generate Gmail App Password at https://myaccount.google.com/apppasswords (requires 2FA)

#### Payment (Razorpay)
```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx
```

#### Frontend URL (for CORS)
```
CLIENT_URL=https://campus-canteen-hub.vercel.app
```

### Removed Variables
The following are no longer needed (code migrated from Resend to Gmail SMTP):
- `RESEND_API_KEY` (remove if present)
- `RESEND_FROM` (remove if present)

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
1. Check Render logs for SMTP errors
2. Verify all SMTP_* variables are set in Render
3. Ensure SMTP_PASS is a valid Gmail App Password
4. Check Gmail spam folder
5. Verify Render backend URL is correct in frontend

### CORS Errors
1. Verify `CLIENT_URL` matches your Vercel domain
2. Check `ALLOWED_ORIGINS` in `server/src/app.js`
3. Ensure backend is deployed and accessible

### Server Timeout
- Email sending is now non-blocking (fire-and-forget)
- Login should respond immediately
- Email sends in background
