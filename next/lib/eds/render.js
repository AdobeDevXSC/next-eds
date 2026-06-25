import { resolveBlock } from '../../blocks/registry.js';

// Maps the normalized EDS tree → React elements. This is the "decorate" half of aem.js,
// replaced by component resolution.
export function renderNode(node, key) {
  if (node.kind === 'section') {
    return (
      <div className="section" key={key}>
        {node.children.map((child, i) => renderNode(child, i))}
      </div>
    );
  }

  if (node.kind === 'block') {
    const Block = resolveBlock(node.name);
    if (Block) return <Block key={key} {...node} />;
    // Unknown block: render nothing styled, but keep it visible for the spike.
    return (
      <div className={`block ${node.name} (unmapped)`} key={key}>
        {/* eslint-disable-next-line react/no-danger */}
        <pre>unmapped block: {node.name}</pre>
      </div>
    );
  }

  // default content (headings, paragraphs, lists, …)
  return (
    // eslint-disable-next-line react/no-danger
    <div key={key} dangerouslySetInnerHTML={{ __html: node.html }} />
  );
}
