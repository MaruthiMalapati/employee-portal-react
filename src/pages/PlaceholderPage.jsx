export default function PlaceholderPage({ title }) {
  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="page-hero-content">
          <div>
            <div className="muted-kicker text-white-50">Coming Soon</div>
            <h2 className="page-hero-title">{title}</h2>
            <p className="page-hero-text">
              This area is being prepared to match the refreshed portal experience.
            </p>
          </div>
        </div>
      </section>

      <section className="content-card content-card-center">
        <div className="text-center">
          <h3 className="section-title mb-3">This page has not been migrated from the static frontend yet.</h3>
          <p className="text-muted mb-0">
            The new shared header and interface styling will automatically carry over when this screen is implemented.
          </p>
        </div>
      </section>
    </div>
  );
}
