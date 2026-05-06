export default function PlaceholderPage({ title }) {
  return (
    <section className="content-card content-card-center">
      <div className="text-center">
        <h2 className="mb-3">{title}</h2>
        <p className="text-muted mb-0">
          This page has not been migrated from the static frontend yet.
        </p>
      </div>
    </section>
  );
}
