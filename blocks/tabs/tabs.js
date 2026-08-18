// Tabs — portable OOTB presentation block (Tier 1). Accessible tablist; each row is a tab
// (cell[0] = label, cell[1] = panel). This is the one Tier-1 block that is inherently
// interactive, so it decorates client-side in both runtimes.
export default function decorate(block) {
  const rows = [...block.children];
  const tablist = document.createElement('div');
  tablist.className = 'tabs-list';
  tablist.setAttribute('role', 'tablist');

  const buttons = [];
  const panels = [];

  const activate = (idx) => {
    buttons.forEach((b, j) => b.setAttribute('aria-selected', j === idx ? 'true' : 'false'));
    panels.forEach((p, j) => p.setAttribute('aria-hidden', j === idx ? 'false' : 'true'));
  };

  rows.forEach((row, i) => {
    const cells = row.children;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tabs-tab';
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    btn.innerHTML = cells[0]?.innerHTML ?? '';
    btn.addEventListener('click', () => activate(i));

    const panel = document.createElement('div');
    panel.className = 'tabs-panel';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
    panel.innerHTML = cells[1]?.innerHTML ?? '';

    buttons.push(btn);
    panels.push(panel);
    tablist.append(btn);
  });

  block.textContent = '';
  block.append(tablist, ...panels);
}
