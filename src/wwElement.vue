<template>
  <div class="spread-cart" :class="{ 'spread-cart--open': isOpenComputed }">
    <!-- Backdrop (hidden in editor to avoid covering the canvas) -->
    <div
      v-if="isOpenComputed && !isEditorMode"
      class="spread-cart__backdrop"
      @click="handleClose"
    ></div>

    <!-- Drawer panel -->
    <div class="spread-cart__drawer" :class="{ 'spread-cart__drawer--open': isOpenComputed, 'spread-cart__drawer--editor': isEditorMode }">
      <!-- Header -->
      <div class="spread-cart__header">
        <h2 class="spread-cart__title">Your Cart</h2>
        <span class="spread-cart__count" v-if="cartData.item_count > 0">
          {{ cartData.item_count }} {{ cartData.item_count === 1 ? 'item' : 'items' }}
        </span>
        <button class="spread-cart__close" @click="handleClose" aria-label="Close cart">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- Gate overlay -->
      <div class="spread-cart__gate-overlay" v-if="isGated">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="11" width="18" height="11" rx="2" stroke="#4B162D" stroke-width="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4" stroke="#4B162D" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span class="spread-cart__gate-text">Sign in to view your cart</span>
      </div>

      <!-- Loading -->
      <div class="spread-cart__loading" v-else-if="loading">
        <div class="spread-cart__spinner"></div>
        <span>Loading cart…</span>
      </div>

      <!-- Empty state -->
      <div class="spread-cart__empty" v-else-if="!cartData.items || cartData.items.length === 0">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
          <circle cx="9" cy="21" r="1" stroke="#94A3B8" stroke-width="2"/>
          <circle cx="20" cy="21" r="1" stroke="#94A3B8" stroke-width="2"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p class="spread-cart__empty-text">Your cart is empty</p>
        <p class="spread-cart__empty-sub">Browse our products and add something delicious.</p>
      </div>

      <!-- Items list -->
      <div class="spread-cart__items" v-else>
        <div
          v-for="item in cartData.items"
          :key="item.id"
          class="spread-cart__item"
        >
          <!-- Item image -->
          <div class="spread-cart__item-image-wrap">
            <img
              v-if="item.image_url"
              :src="item.image_url"
              :alt="item.product_name"
              class="spread-cart__item-image"
              loading="lazy"
            />
            <div v-else class="spread-cart__item-image-placeholder">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="2" width="20" height="20" rx="4" stroke="#CBD5E1" stroke-width="1.5"/>
              </svg>
            </div>
          </div>

          <!-- Item details -->
          <div class="spread-cart__item-details">
            <p class="spread-cart__item-name">{{ item.product_name }}</p>
            <p class="spread-cart__item-variant" v-if="item.variant_name">{{ item.variant_name }}</p>
            <p class="spread-cart__item-price">${{ formatPrice(item.unit_price) }} each</p>
          </div>

          <!-- Qty stepper -->
          <div class="spread-cart__qty-stepper">
            <button
              class="spread-cart__qty-btn"
              :disabled="updatingItem === item.id"
              @click="handleQtyChange(item, item.qty - 1)"
              aria-label="Decrease quantity"
            >−</button>
            <span class="spread-cart__qty-value">{{ item.qty }}</span>
            <button
              class="spread-cart__qty-btn"
              :disabled="updatingItem === item.id"
              @click="handleQtyChange(item, item.qty + 1)"
              aria-label="Increase quantity"
            >+</button>
          </div>

          <!-- Line total + remove -->
          <div class="spread-cart__item-end">
            <span class="spread-cart__item-total">${{ formatPrice(item.line_total) }}</span>
            <button
              class="spread-cart__remove-btn"
              :disabled="updatingItem === item.id"
              @click="handleRemove(item)"
              aria-label="Remove item"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Footer (sticky) -->
      <div
        class="spread-cart__footer"
        v-if="!isGated && !loading && cartData.items && cartData.items.length > 0"
      >
        <div class="spread-cart__subtotal-row">
          <span class="spread-cart__subtotal-label">Subtotal</span>
          <span class="spread-cart__subtotal-value">${{ formatPrice(cartData.subtotal) }}</span>
        </div>
        <p class="spread-cart__shipping-note">Delivery fee calculated at checkout</p>
        <button
          class="spread-cart__checkout-btn"
          :disabled="checkingOut"
          @click="handleCheckout"
        >
          <span v-if="checkingOut" class="spread-cart__spinner spread-cart__spinner--sm"></span>
          <span v-else>Checkout</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue';

/* ------------------------------------------------------------------ */
/*  Inline Supabase client (self-contained — no shared lib imports)   */
/* ------------------------------------------------------------------ */
function createSpreadClient({ supabaseUrl, supabaseAnonKey, accessToken = null }) {
  const headers = { 'Content-Type': 'application/json', apikey: supabaseAnonKey };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  return {
    async rpc(fn, params = {}) {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw Object.assign(new Error(e.message || res.statusText), { status: res.status, code: e.code });
      }
      return res.json();
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Editor mock data                                                  */
/* ------------------------------------------------------------------ */
const EDITOR_MOCK_CART = {
  cart_id: '00000000-0000-0000-0000-000000000099',
  items: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      product_name: 'Organic Roma Tomatoes',
      variant_name: '500g',
      unit_price: 650,
      qty: 2,
      line_total: 1300,
      image_url: '',
      product_id: '00000000-0000-0000-0000-000000000010',
      variant_id: '00000000-0000-0000-0000-000000000020',
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      product_name: 'Free-Range Eggs (Dozen)',
      variant_name: null,
      unit_price: 890,
      qty: 1,
      line_total: 890,
      image_url: '',
      product_id: '00000000-0000-0000-0000-000000000011',
      variant_id: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      product_name: 'Sourdough Loaf',
      variant_name: 'Whole Wheat',
      unit_price: 1200,
      qty: 1,
      line_total: 1200,
      image_url: '',
      product_id: '00000000-0000-0000-0000-000000000012',
      variant_id: '00000000-0000-0000-0000-000000000021',
    },
  ],
  subtotal: 3390,
  item_count: 4,
};

export default {
  props: {
    /* wwEditor:start */
    wwEditorState: { type: Object, required: true },
    /* wwEditor:end */
    content: { type: Object, required: true },
    wwFrontState: { type: Object, required: true },
    wwElementState: { type: Object, required: true },
  },
  emits: ['trigger-event', 'update:content'],

  setup(props, { emit }) {
    /* ── Component variables (exposed to WeWeb bindings) ── */
    const { value: wwCartItemCount, setValue: setWwCartItemCount } =
      wwLib.wwVariable.useComponentVariable({
        uid: 'cartItemCount',
        name: 'Cart Item Count',
        type: 'number',
        defaultValue: 0,
      });
    const { value: wwCartSubtotal, setValue: setWwCartSubtotal } =
      wwLib.wwVariable.useComponentVariable({
        uid: 'cartSubtotal',
        name: 'Cart Subtotal (cents)',
        type: 'number',
        defaultValue: 0,
      });

    return {
      wwCartItemCount, setWwCartItemCount,
      wwCartSubtotal, setWwCartSubtotal,
    };
  },

  data() {
    return {
      loading: false,
      cartData: { cart_id: null, items: [], subtotal: 0, item_count: 0 },
      updatingItem: null,
      checkingOut: false,
      _lastRefreshTrigger: 0,
    };
  },

  computed: {
    isEditorMode() {
      return !!(this.wwEditorState);
    },
    isOpenComputed() {
      return this.isEditorMode || !!this.content?.isOpen;
    },
    hasToken() {
      return !!(this.content?.accessToken);
    },
    accessModeValue() {
      return this.content?.accessMode || 'members_only';
    },
    isGated() {
      return this.accessModeValue === 'members_only' && !this.hasToken;
    },
  },

  watch: {
    'content.isOpen'(val) {
      if (val && !this.isGated) {
        this.fetchCart();
      }
    },
    'content.refreshTrigger'(newVal) {
      if (newVal !== this._lastRefreshTrigger) {
        this._lastRefreshTrigger = newVal;
        this.fetchCart();
      }
    },
  },

  mounted() {
    /* wwEditor:start */
    if (typeof wwLib !== 'undefined' && this.wwEditorState) {
      this.cartData = { ...EDITOR_MOCK_CART };
      this.setWwCartItemCount(EDITOR_MOCK_CART.item_count);
      this.setWwCartSubtotal(EDITOR_MOCK_CART.subtotal);
      return;
    }
    /* wwEditor:end */

    if (this.content?.isOpen && !this.isGated) {
      this.fetchCart();
    }
  },

  methods: {
    /* ── Client factory ── */
    makeClient() {
      const url = this.content?.supabaseUrl;
      const key = this.content?.supabaseAnonKey;
      const token = this.content?.accessToken;
      if (!url || !key) throw new Error('Supabase URL and Anon Key are required');
      return createSpreadClient({ supabaseUrl: url, supabaseAnonKey: key, accessToken: token });
    },

    /* ── Fetch cart summary ── */
    async fetchCart() {
      if (this.isGated) return;
      this.loading = true;
      try {
        const client = this.makeClient();
        const data = await client.rpc('get_cart_summary');
        if (data && typeof data === 'object') {
          this.cartData = {
            cart_id: data.cart_id || null,
            items: Array.isArray(data.items) ? data.items : [],
            subtotal: Number(data.subtotal) || 0,
            item_count: Number(data.item_count) || 0,
          };
        } else {
          this.cartData = { cart_id: null, items: [], subtotal: 0, item_count: 0 };
        }
        this.syncComponentVars();
      } catch (err) {
        console.error('Failed to fetch cart:', err.message);
        this.$emit('trigger-event', {
          name: 'cart:error',
          event: { message: err.message || 'Failed to load cart' },
        });
      } finally {
        this.loading = false;
      }
    },

    /* ── Sync component variables ── */
    syncComponentVars() {
      this.setWwCartItemCount(this.cartData.item_count);
      this.setWwCartSubtotal(this.cartData.subtotal);
      this.$emit('trigger-event', {
        name: 'cart:updated',
        event: { itemCount: this.cartData.item_count, subtotal: this.cartData.subtotal },
      });
    },

    /* ── Qty change (stepper) ── */
    async handleQtyChange(item, newQty) {
      if (this.updatingItem) return;
      if (newQty < 0) newQty = 0;
      this.updatingItem = item.id;
      try {
        const client = this.makeClient();
        if (newQty === 0) {
          await client.rpc('remove_cart_item', { p_cart_item_id: item.id });
        } else {
          await client.rpc('update_cart_item_qty', { p_cart_item_id: item.id, p_quantity: newQty });
        }
        await this.fetchCart();
      } catch (err) {
        console.error('Failed to update quantity:', err.message);
        this.$emit('trigger-event', {
          name: 'cart:error',
          event: { message: err.message || 'Failed to update quantity' },
        });
      } finally {
        this.updatingItem = null;
      }
    },

    /* ── Remove item ── */
    async handleRemove(item) {
      if (this.updatingItem) return;
      this.updatingItem = item.id;
      try {
        const client = this.makeClient();
        await client.rpc('remove_cart_item', { p_cart_item_id: item.id });
        await this.fetchCart();
      } catch (err) {
        console.error('Failed to remove item:', err.message);
        this.$emit('trigger-event', {
          name: 'cart:error',
          event: { message: err.message || 'Failed to remove item' },
        });
      } finally {
        this.updatingItem = null;
      }
    },

    /* ── Checkout ── */
    handleCheckout() {
      if (!this.cartData.cart_id || this.checkingOut) return;
      this.$emit('trigger-event', {
        name: 'cart:checkout',
        event: {
          cartId: this.cartData.cart_id,
          subtotal: this.cartData.subtotal,
          itemCount: this.cartData.item_count,
        },
      });
    },

    /* ── Close ── */
    handleClose() {
      this.$emit('trigger-event', { name: 'cart:close', event: {} });
      this.$emit('update:content', { isOpen: false });
    },

    /* ── Helpers ── */
    formatPrice(cents) {
      const val = Number(cents) || 0;
      return (val / 100).toFixed(2);
    },
  },
};
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════ */
/*  Design tokens (Spread.co design system)                          */
/* ═══════════════════════════════════════════════════════════════════ */
.spread-cart {
  --spread-tyrian: #4B162D;
  --spread-burnt-orange: #CE6632;
  --spread-burnt-orange-hover: #B5572B;
  --spread-cream: #FBFAF8;
  --spread-bone-border: #F3EADF;
  --spread-shell-border: #EFE7DE;
  --spread-text-primary: #1A0F14;
  --spread-text-secondary: #6B5E63;
  --spread-text-muted: #94A3B8;
  --spread-radius-lg: 16px;
  --spread-radius-md: 12px;
  --spread-radius-sm: 8px;
  --spread-font-stack: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --spread-shadow-lg: 0 20px 60px rgba(75, 22, 45, 0.15), 0 4px 16px rgba(0, 0, 0, 0.08);
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Backdrop                                                          */
/* ═══════════════════════════════════════════════════════════════════ */
.spread-cart__backdrop {
  position: fixed;
  inset: 0;
  background: rgba(26, 15, 20, 0.45);
  z-index: 9998;
  animation: spread-cart-fade-in 0.2s ease-out;
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Drawer                                                            */
/* ═══════════════════════════════════════════════════════════════════ */
.spread-cart__drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 400px;
  max-width: 100vw;
  background: var(--spread-cream);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  box-shadow: var(--spread-shadow-lg);
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  font-family: var(--spread-font-stack);
}

.spread-cart__drawer--open {
  transform: translateX(0);
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Header                                                            */
/* ═══════════════════════════════════════════════════════════════════ */
.spread-cart__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px 24px;
  border-bottom: 1px solid var(--spread-bone-border);
  flex-shrink: 0;
}

.spread-cart__title {
  font-size: 18px;
  font-weight: 700;
  color: var(--spread-tyrian);
  margin: 0;
  flex: 1;
}

.spread-cart__count {
  font-size: 13px;
  font-weight: 500;
  color: var(--spread-text-secondary);
  background: var(--spread-bone-border);
  padding: 2px 10px;
  border-radius: 20px;
}

.spread-cart__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--spread-text-secondary);
  cursor: pointer;
  border-radius: var(--spread-radius-sm);
  transition: background 0.15s, color 0.15s;
}

.spread-cart__close:hover {
  background: var(--spread-bone-border);
  color: var(--spread-tyrian);
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Gate overlay                                                      */
/* ═══════════════════════════════════════════════════════════════════ */
.spread-cart__gate-overlay {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px 24px;
  text-align: center;
}

.spread-cart__gate-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--spread-tyrian);
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Loading                                                           */
/* ═══════════════════════════════════════════════════════════════════ */
.spread-cart__loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--spread-text-secondary);
  font-size: 14px;
}

.spread-cart__spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--spread-bone-border);
  border-top-color: var(--spread-burnt-orange);
  border-radius: 50%;
  animation: spread-cart-spin 0.6s linear infinite;
}

.spread-cart__spinner--sm {
  width: 18px;
  height: 18px;
  border-width: 2px;
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Empty state                                                       */
/* ═══════════════════════════════════════════════════════════════════ */
.spread-cart__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 24px;
  text-align: center;
}

.spread-cart__empty-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--spread-tyrian);
  margin: 8px 0 0;
}

.spread-cart__empty-sub {
  font-size: 14px;
  color: var(--spread-text-secondary);
  margin: 0;
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Items list (scrollable)                                           */
/* ═══════════════════════════════════════════════════════════════════ */
.spread-cart__items {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.spread-cart__item {
  display: grid;
  grid-template-columns: 56px 1fr auto auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  background: #fff;
  border-radius: var(--spread-radius-md);
  border: 1px solid var(--spread-bone-border);
  transition: border-color 0.15s;
}

.spread-cart__item:hover {
  border-color: var(--spread-shell-border);
}

/* ── Item image ── */
.spread-cart__item-image-wrap {
  width: 56px;
  height: 56px;
  border-radius: var(--spread-radius-sm);
  overflow: hidden;
  background: var(--spread-bone-border);
  flex-shrink: 0;
}

.spread-cart__item-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.spread-cart__item-image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--spread-bone-border);
}

/* ── Item details ── */
.spread-cart__item-details {
  min-width: 0;
}

.spread-cart__item-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--spread-text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.spread-cart__item-variant {
  font-size: 12px;
  color: var(--spread-text-secondary);
  margin: 2px 0 0;
}

.spread-cart__item-price {
  font-size: 12px;
  color: var(--spread-text-muted);
  margin: 2px 0 0;
}

/* ── Qty stepper ── */
.spread-cart__qty-stepper {
  display: flex;
  align-items: center;
  gap: 0;
  border: 1px solid var(--spread-bone-border);
  border-radius: var(--spread-radius-sm);
  overflow: hidden;
}

.spread-cart__qty-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--spread-tyrian);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.spread-cart__qty-btn:hover:not(:disabled) {
  background: var(--spread-bone-border);
}

.spread-cart__qty-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.spread-cart__qty-value {
  width: 28px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--spread-text-primary);
  border-left: 1px solid var(--spread-bone-border);
  border-right: 1px solid var(--spread-bone-border);
  line-height: 28px;
}

/* ── Item end (total + remove) ── */
.spread-cart__item-end {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.spread-cart__item-total {
  font-size: 14px;
  font-weight: 700;
  color: var(--spread-tyrian);
}

.spread-cart__remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--spread-text-muted);
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}

.spread-cart__remove-btn:hover:not(:disabled) {
  background: #fef2f2;
  color: #dc2626;
}

.spread-cart__remove-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Footer (sticky)                                                   */
/* ═══════════════════════════════════════════════════════════════════ */
.spread-cart__footer {
  flex-shrink: 0;
  padding: 20px 24px;
  border-top: 1px solid var(--spread-bone-border);
  background: #fff;
}

.spread-cart__subtotal-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.spread-cart__subtotal-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--spread-text-primary);
}

.spread-cart__subtotal-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--spread-tyrian);
}

.spread-cart__shipping-note {
  font-size: 12px;
  color: var(--spread-text-muted);
  margin: 0 0 16px;
}

.spread-cart__checkout-btn {
  width: 100%;
  height: 48px;
  border: none;
  border-radius: var(--spread-radius-md);
  background: var(--spread-burnt-orange);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  font-family: var(--spread-font-stack);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 0.15s, transform 0.1s;
}

.spread-cart__checkout-btn:hover:not(:disabled) {
  background: var(--spread-burnt-orange-hover);
}

.spread-cart__checkout-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.spread-cart__checkout-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Responsive (mobile-first)                                         */
/* ═══════════════════════════════════════════════════════════════════ */
@media (max-width: 480px) {
  .spread-cart__drawer {
    width: 100vw;
  }

  .spread-cart__item {
    grid-template-columns: 48px 1fr auto;
    gap: 8px;
  }

  .spread-cart__item-end {
    grid-column: 2 / -1;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Animations                                                        */
/* ═══════════════════════════════════════════════════════════════════ */
@keyframes spread-cart-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes spread-cart-spin {
  to { transform: rotate(360deg); }
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Editor override — render inline instead of fixed off-screen       */
/* ═══════════════════════════════════════════════════════════════════ */
.spread-cart__drawer--editor {
  position: relative !important;
  transform: none !important;
  width: 100% !important;
  max-height: 520px;
  border: 1px dashed var(--spread-bone-border);
  border-radius: var(--spread-radius-lg);
  box-shadow: none !important;
}
</style>
