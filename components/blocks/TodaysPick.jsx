import { parse } from 'node-html-parser';
import PickAddButton from './PickAddButton.jsx';
import './todays-pick.css';

// Today's Pick — Tier-2 RSC island (registered in lib/registry.js; see
// docs/architecture/blocks-and-rsc.md). The add-to-order button needs the cart's useOrder(), so
// this block renders only in the Next app and is intentionally absent on raw EDS.
//
// Content model: ONE row, 5 cells, all plain text —
//   [badge, name, price, description, add-button label]
// The decorative stack-brick colors are NOT authored; they're baked below (a fixed brand
// illustration from the original design handoff), the same pattern blocks/hero-stack and
// blocks/two-ways use for their own baked decoration.
//
// Self-contained: does not import from app/(site)/home/ (a later task deletes that directory).
// ./PickAddButton.jsx is a local copy of app/(site)/home/PickAddButton.jsx's cart logic.
const STACK_COLORS = ['#E7C288', '#D9A273', '#F2C14E', '#B98A3C', '#E7C288'];

function cellText(cell) {
  return cell?.html ? parse(cell.html).textContent.trim() : '';
}

/**
 * Renders the todays-pick block.
 * @param {string[]} variants block variant classes (from the block's class list)
 * @param {Array<Array<{html: string, pictureOnly: boolean}>>} rows parsed block rows/cells
 */
export default function TodaysPick({ variants = [], rows = [] }) {
  const cells = rows[0] ?? [];
  const badge = cellText(cells[0]);
  const name = cellText(cells[1]);
  const price = cellText(cells[2]);
  const description = cellText(cells[3]);
  const addLabel = cellText(cells[4]);

  return (
    <div className={['todays-pick', ...variants, 'block'].join(' ')}>
      <div className="pick-card">
        <div className="pick-well">
          <span className="pick-badge">{badge}</span>
          <div className="pick-stack">
            {STACK_COLORS.map((color, i) => (
              <span
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                className="pick-brick"
                style={{ '--brick-color': color }}
              />
            ))}
          </div>
        </div>
        <div className="pick-body">
          <div className="pick-titlerow">
            <h3 className="pick-name">{name}</h3>
            <span className="pick-price">{price}</span>
          </div>
          <p className="pick-desc">{description}</p>
          <PickAddButton name={name} priceDisplay={price} label={addLabel} />
        </div>
      </div>
    </div>
  );
}
