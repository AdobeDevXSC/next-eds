import { resolveBlock } from '../registry.js';
import LegacyBlock from './LegacyBlock.jsx';

// Maps the normalized EDS tree → React elements. This is the "decorate" half of aem.js,
// replaced by component resolution.
export function renderNode(node, key) {
  if (node.kind === 'section') {
    const className = ['section', ...(node.styles || [])].join(' ');
    return (
      <div className={className} key={key}>
        {node.children.map((child, i) => renderNode(child, i))}
      </div>
    );
  }

  if (node.kind === 'block') {
    const Block = resolveBlock(node.name);
    if (Block) return <Block key={key} {...node} />;
    // No ported component: fall back to the classic EDS path — server-render the block
    // markup and run its native decorate() on the client (see LegacyBlock).
    return (
      <LegacyBlock
        key={key}
        name={node.name}
        variants={node.variants}
        rows={node.rows}
        html={node.html}
      />
    );
  }

  // default content (headings, paragraphs, lists, …)
  return (
    // eslint-disable-next-line react/no-danger
    <div key={key} dangerouslySetInnerHTML={{ __html: node.html }} />
  );
}
