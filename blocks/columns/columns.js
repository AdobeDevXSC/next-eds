// Columns — portable OOTB presentation block (Tier 1). Adds a column-count class on the block
// and marks picture-only cells so CSS can lay out image columns.
export default function decorate(block) {
  const cols = block.querySelector(':scope > div')?.children.length ?? 0;
  block.classList.add(`columns-${cols}-cols`);
  [...block.children].forEach((row) => {
    [...row.children].forEach((cell) => {
      if (cell.children.length === 1 && cell.querySelector('picture')) {
        cell.classList.add('columns-img-col');
      }
    });
  });
}
