'use client';

import { useOrder } from '../../../../lib/order/OrderProvider.jsx';

export default function MenuItemDetail({ item, showSignInPrompt }) {
  const { addToOrder } = useOrder();
  return (
    <div className="menu-item-actions">
      <button
        type="button"
        className="btn btn-primary menu-item-add"
        onClick={() => addToOrder({ name: item.name, unitPriceCents: item.priceCents })}
      >
        {`Add to order · $${(item.priceCents / 100).toFixed(2)}`}
      </button>
      {showSignInPrompt && (
        <p className="menu-item-signin">
          <a href="/signin">Sign in</a>
          {' to save your usual and earn stamps.'}
        </p>
      )}
    </div>
  );
}
