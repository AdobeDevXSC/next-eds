// Cards — portable OOTB presentation block (Tier 1). Each row → <li>; each cell classed as
// image or body. Pictures arrive pre-optimized from EDS, so there is no createOptimizedPicture.
export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    [...row.children].forEach((cell) => {
      const div = document.createElement('div');
      const pictureOnly = cell.children.length === 1 && !!cell.querySelector('picture');
      div.className = pictureOnly ? 'cards-card-image' : 'cards-card-body';
      div.innerHTML = cell.innerHTML;
      li.append(div);
    });
    ul.append(li);
  });
  block.textContent = '';
  block.append(ul);
}
