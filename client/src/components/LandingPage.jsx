function LandingPage({ onLogin, onRegister }) {
  return (
    <section className="panel landing-hero">
      <div className="landing-hero__copy">
        <span className="eyebrow">Campus Ordering</span>
        <h1>One place for every campus craving.</h1>
        <p>
          A polished canteen platform for students to browse, search, and order quickly, while
          vendors manage menus and live order flow from a focused dashboard.
        </p>

        <div className="landing-hero__actions">
          <button className="primary-button" type="button" onClick={onLogin}>
            Login to Continue
          </button>
          <button className="ghost-button" type="button" onClick={onRegister}>
            Create an Account
          </button>
        </div>

        <div className="landing-highlights">
          <div className="landing-highlight-pill">Menu Search</div>
          <div className="landing-highlight-pill">Live Order Tracking</div>
          <div className="landing-highlight-pill">Vendor Dashboards</div>
        </div>
      </div>

      <div className="landing-preview">
        <div className="landing-preview__window">
          <div className="landing-preview__chrome">
            <span></span>
            <span></span>
            <span></span>
          </div>

          <div className="landing-preview__content">
            <div className="landing-preview__panel landing-preview__panel--hero">
              <span className="eyebrow">Today&apos;s Favourites</span>
              <strong>Veg Burger</strong>
              <p>Served hot from Sai Tiffins with quick pickup.</p>
            </div>

            <div className="landing-preview__grid">
              <div className="landing-stat-card">
                <span>For Students</span>
                <strong>Discover menus fast</strong>
                <p>Search dishes, compare hotels, and order in a few taps.</p>
              </div>

              <div className="landing-stat-card landing-stat-card--accent">
                <span>For Vendors</span>
                <strong>Manage daily rush</strong>
                <p>Track orders, update status, and see daily revenue clearly.</p>
              </div>
            </div>

            <div className="landing-preview__footer">
              <div className="landing-preview__metric">
                <span>Hotels</span>
                <strong>12+</strong>
              </div>
              <div className="landing-preview__metric">
                <span>Orders</span>
                <strong>Live</strong>
              </div>
              <div className="landing-preview__metric">
                <span>Status</span>
                <strong>Tracked</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default LandingPage;
