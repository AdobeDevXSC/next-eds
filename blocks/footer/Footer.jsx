import './footer.css';

// Footer is a Server Component — static content from the /footer fragment. The
// data-block-status="loaded" attribute matches what styles.css expects to make it visible.
export default function Footer({ html }) {
  return (
    <div
      className="footer"
      data-block-status="loaded"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
