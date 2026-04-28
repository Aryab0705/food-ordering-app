import { useMemo, useState } from 'react';

const initialState = {
  name: '',
  email: '',
  password: '',
  phone: '',
  role: 'student',
  shopName: '',
  shopAddress: '',
};

function AuthForm({
  mode,
  onSubmit,
  loading,
  otpStep = false,
  otpEmail = '',
  onVerifyOtp,
  onResendOtp,
  onBackToLogin,
}) {
  const [formData, setFormData] = useState(initialState);
  const [otp, setOtp] = useState('');

  const heading = useMemo(
    () => {
      if (otpStep) {
        return 'Verify your email to complete login';
      }

      return mode === 'login' ? 'Sign in to your canteen account' : 'Create your campus account';
    },
    [mode, otpStep],
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(formData);
  };

  const handleOtpSubmit = (event) => {
    event.preventDefault();
    onVerifyOtp(otp);
  };

  if (otpStep) {
    return (
      <form className="panel auth-form" onSubmit={handleOtpSubmit}>
        <div className="section-heading">
          <span className="eyebrow">Email Verification</span>
          <h2>{heading}</h2>
          <p>
            Enter the 6-digit OTP sent to <strong>{otpEmail}</strong> to continue.
          </p>
        </div>

        <label>
          OTP Code
          <input
            name="otp"
            type="text"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Enter 6-digit OTP"
            inputMode="numeric"
            maxLength="6"
            required
          />
        </label>

        <div className="button-row">
          <button className="primary-button" type="submit" disabled={loading || otp.length !== 6}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
          <button className="ghost-button" type="button" onClick={onResendOtp} disabled={loading}>
            Resend OTP
          </button>
          <button className="ghost-button" type="button" onClick={onBackToLogin} disabled={loading}>
            Back
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="panel auth-form" onSubmit={handleSubmit}>
      <div className="section-heading">
        <span className="eyebrow">{mode === 'login' ? 'Welcome back' : 'New user'}</span>
        <h2>{heading}</h2>
        <p>
          {mode === 'login'
            ? 'Students can order instantly and vendors can manage live orders.'
            : 'Pick the right role to unlock the correct dashboard and workflow.'}
        </p>
      </div>

      {mode === 'register' ? (
        <label>
          Full Name
          <input
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            placeholder="Aarav Sharma"
            required
          />
        </label>
      ) : null}

      <label>
        Email Address
        <input
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="student@college.edu"
          required
        />
      </label>

      {mode === 'register' ? (
        <label>
          Phone Number
          <input
            name="phone"
            type="text"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+91 98765 43210"
          />
        </label>
      ) : null}

      {mode === 'register' ? (
        <label>
          Role
          <select name="role" value={formData.role} onChange={handleChange}>
            <option value="student">Student</option>
            <option value="vendor">Vendor</option>
          </select>
        </label>
      ) : null}

      {mode === 'register' && formData.role === 'vendor' ? (
        <label>
          Shop Name
          <input
            name="shopName"
            type="text"
            value={formData.shopName}
            onChange={handleChange}
            placeholder="Sai Tiffins"
            required
          />
        </label>
      ) : null}

      {mode === 'register' && formData.role === 'vendor' ? (
        <label>
          Shop Address
          <input
            name="shopAddress"
            type="text"
            value={formData.shopAddress}
            onChange={handleChange}
            placeholder="Block A Canteen, Ground Floor"
            required
          />
        </label>
      ) : null}

      <label>
        Password
        <input
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Minimum 6 characters"
          required
        />
      </label>

      <button className="primary-button" type="submit" disabled={loading}>
        {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}
      </button>
    </form>
  );
}

export default AuthForm;
