import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from 'react-bootstrap';
import { deleteProduct, getProducts, saveProduct, type Product } from '../../api/auth';

interface ProductForm {
  name: string;
  price: string;
  wholesale_price: string;
  description: string;
  image_url: string;
  status: string;
}

const emptyForm = (): ProductForm => ({
  name: '',
  price: '',
  wholesale_price: '',
  description: '',
  image_url: '',
  status: 'active',
});

const getError = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';

interface ProductFieldsProps {
  id: string;
  value: ProductForm;
  onChange: (value: ProductForm) => void;
  onReadingChange: (reading: boolean) => void;
}

function ProductFields({ id, value, onChange, onReadingChange }: ProductFieldsProps) {
  const [imageError, setImageError] = useState('');
  const [reading, setReading] = useState(false);

  const chooseImage = async (file?: File) => {
    setImageError('');
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageError('Please choose an image file.');
      return;
    }

    setReading(true);
    onReadingChange(true);

    try {
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Unable to read this image.'));
        reader.onabort = () => reject(new Error('Image upload was cancelled.'));
        reader.readAsDataURL(file);
      });
      onChange({ ...value, image_url: image });
    } catch (error) {
      setImageError(getError(error));
    } finally {
      setReading(false);
      onReadingChange(false);
    }
  };

  return (
    <fieldset disabled={reading}>
      <div className="row g-3">
        <div className="col-md-6">
          <label htmlFor={`${id}-name`} className="form-label small fw-bold">
            PRODUCT NAME
          </label>
          <input
            id={`${id}-name`}
            className="form-control"
            placeholder="Business cards"
            required
            value={value.name}
            onChange={(event) => onChange({ ...value, name: event.target.value })}
          />
        </div>
        <div className="col-md-3">
          <label htmlFor={`${id}-price`} className="form-label small fw-bold">
            RETAIL PRICE ($)
          </label>
          <input
            id={`${id}-price`}
            className="form-control"
            type="number"
            min="0"
            step="0.01"
            required
            value={value.price}
            onChange={(event) => onChange({ ...value, price: event.target.value })}
          />
        </div>
        <div className="col-md-3"><label htmlFor={`${id}-wholesale`} className="form-label small fw-bold">WHOLESALE PRICE ($)</label><input id={`${id}-wholesale`} className="form-control" type="number" min="0" max="21474836.47" step="0.01" required value={value.wholesale_price} onChange={event => onChange({ ...value, wholesale_price: event.target.value })} /></div>
        <div className="col-md-3">
          <label htmlFor={`${id}-status`} className="form-label small fw-bold">
            STATUS
          </label>
          <select
            id={`${id}-status`}
            className="form-select"
            value={value.status}
            onChange={(event) => onChange({ ...value, status: event.target.value })}
          >
            <option value="active">Active</option>
            <option value="retired">Retired</option>
          </select>
        </div>
        <div className="col-md-7">
          <label htmlFor={`${id}-description`} className="form-label small fw-bold">
            DESCRIPTION
          </label>
          <textarea
            id={`${id}-description`}
            className="form-control"
            rows={3}
            value={value.description}
            onChange={(event) => onChange({ ...value, description: event.target.value })}
          />
        </div>
        <div className="col-md-5">
          <label htmlFor={`${id}-image`} className="form-label small fw-bold">
            PRODUCT IMAGE
          </label>
          <input
            id={`${id}-image`}
            className="form-control"
            type="file"
            accept="image/*"
            onChange={(event) => void chooseImage(event.target.files?.[0])}
          />
          {reading && <p role="status">Reading image...</p>}
          {imageError && <p className="text-danger" role="alert">{imageError}</p>}
          {value.image_url && (
            <img
              src={value.image_url}
              alt="Product preview"
              className="mt-3 rounded border"
              style={{ width: 120, height: 90, objectFit: 'cover' }}
            />
          )}
        </div>
      </div>
    </fieldset>
  );
}

export const ProductManager = ({ adminId }: { adminId?: number }) => {
  const [items, setItems] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [formKey, setFormKey] = useState(0);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<ProductForm>(emptyForm);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [readingAddImage, setReadingAddImage] = useState(false);
  const [readingEditImage, setReadingEditImage] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setItems([]);
    setLoading(true);
    setError('');

    if (!adminId) {
      setError('Please sign in again to manage products.');
      setLoading(false);
      return;
    }

    getProducts(adminId)
      .then((products) => {
        if (!cancelled) setItems(products);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(getError(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [adminId]);

  const handleSave = async (event: FormEvent<HTMLFormElement>, isEdit: boolean) => {
    event.preventDefault();
    if (saving || readingAddImage || readingEditImage) return;

    const values = isEdit ? editForm : form;
    const reportError = isEdit ? setModalError : setError;
    const price = Number(values.price);
    const wholesalePrice = Number(values.wholesale_price);
    reportError('');
    setMessage('');

    if (!adminId) {
      reportError('Please sign in again to manage products.');
      return;
    }

    if (!values.name.trim() || !values.price.trim() || !Number.isFinite(price) || price < 0 || !values.wholesale_price.trim() || !Number.isFinite(wholesalePrice) || wholesalePrice < 0 || wholesalePrice > 21474836.47) {
      reportError('Enter a product name and valid non-negative retail and wholesale prices.');
      return;
    }

    setSaving(true);

    try {
      const product = await saveProduct(
        adminId,
        {
          ...values,
          name: values.name.trim(),
          price: String(Math.round(price * 100)),
          wholesale_price: String(Math.round(wholesalePrice * 100)),
        },
        isEdit ? editingProduct?.product_id : undefined,
      );

      setItems((current) =>
        isEdit
          ? current.map((item) => item.product_id === product.product_id ? product : item)
          : [product, ...current],
      );

      if (isEdit) {
        setEditingProduct(null);
      } else {
        setForm(emptyForm());
        setFormKey((current) => current + 1);
      }
      setMessage(isEdit ? 'Product updated.' : 'Product added.');
    } catch (saveError) {
      reportError(getError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (product: Product) => {
    setModalError('');
    setEditForm({
      name: product.name,
      price: (product.price / 100).toFixed(2),
      wholesale_price: product.wholesale_price == null ? '' : (product.wholesale_price / 100).toFixed(2),
      description: product.description ?? '',
      image_url: product.image_url ?? '',
      status: product.status,
    });
    setEditingProduct(product);
  };

  const handleDelete = async () => {
    if (!adminId || !deletingProduct || deleting) return;
    setDeleting(true);
    setModalError('');
    setMessage('');

    try {
      await deleteProduct(adminId, deletingProduct.product_id);
      setItems((current) => current.filter((item) => item.product_id !== deletingProduct.product_id));
      setDeletingProduct(null);
      setMessage('Product deleted.');
    } catch (deleteError) {
      setModalError(getError(deleteError));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="bg-white rounded-4 shadow-sm overflow-hidden">
      <header
        className="p-4 p-md-5 text-white"
        style={{ background: 'linear-gradient(120deg,#09101f,#143d57)' }}
      >
        <small className="text-info fw-bold">CATALOGUE STUDIO</small>
        <h2 className="mt-2">Build your product catalogue</h2>
      </header>

      <div className="p-4">
        <form
          className="rounded-4 p-4 mb-4 bg-light"
          onSubmit={(event) => void handleSave(event, false)}
        >
          <h3 className="h5 mb-3">New product</h3>
          <fieldset disabled={saving || loading || !adminId}>
            <ProductFields
              key={formKey}
              id="add-product"
              value={form}
              onChange={setForm}
              onReadingChange={setReadingAddImage}
            />
            <button className="btn btn-dark mt-3" type="submit" disabled={readingAddImage}>
              {saving && !editingProduct ? 'Saving...' : 'Save product'}
            </button>
          </fieldset>
        </form>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {message && <div className="alert alert-success" role="status">{message}</div>}
        {loading && <p role="status">Loading products...</p>}
        {!loading && !error && items.length === 0 && (
          <p className="text-muted">No products yet. Add your first product using the form above.</p>
        )}

        <div className="row g-3">
          {items.map((product) => (
            <div className="col-md-6 col-xl-4" key={product.product_id}>
              <article className="border rounded-4 overflow-hidden h-100 d-flex flex-column">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-100"
                    style={{ height: 180, objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    className="bg-light text-muted d-flex align-items-center justify-content-center"
                    style={{ height: 180 }}
                  >
                    No image
                  </div>
                )}
                <div className="p-3 d-flex flex-column flex-grow-1">
                  <small className="text-secondary">
                    #{product.product_id} · {product.status}
                  </small>
                  <h3 className="h5 mt-2 text-break">{product.name}</h3>
                  <p className="small text-muted text-break" style={{ whiteSpace: 'pre-wrap' }}>
                    {product.description || 'No description provided.'}
                  </p>
                  <strong>Retail: ${(product.price / 100).toFixed(2)}</strong><span className="mb-3 text-secondary">Wholesale: {product.wholesale_price == null ? 'Not set' : `$${(product.wholesale_price / 100).toFixed(2)}`}</span>
                  <div className="d-flex gap-2 mt-auto">
                    <button
                      className="btn btn-sm btn-outline-dark"
                      type="button"
                      disabled={saving}
                      onClick={() => openEdit(product)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setModalError('');
                        setDeletingProduct(product);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            </div>
          ))}
        </div>
      </div>

      <Modal
        show={editingProduct !== null}
        onHide={() => {
          if (!saving && !readingEditImage) setEditingProduct(null);
        }}
        backdrop="static"
        size="lg"
        centered
        aria-labelledby="edit-product-title"
      >
        <Modal.Header closeButton={!saving && !readingEditImage}>
          <Modal.Title id="edit-product-title">Edit product</Modal.Title>
        </Modal.Header>
        <form onSubmit={(event) => void handleSave(event, true)}>
          <Modal.Body>
            {modalError && <div className="alert alert-danger" role="alert">{modalError}</div>}
            <fieldset disabled={saving}>
              <ProductFields
                key={editingProduct?.product_id}
                id="edit-product"
                value={editForm}
                onChange={setEditForm}
                onReadingChange={setReadingEditImage}
              />
            </fieldset>
          </Modal.Body>
          <Modal.Footer>
            <button
              className="btn btn-outline-secondary"
              type="button"
              disabled={saving || readingEditImage}
              onClick={() => setEditingProduct(null)}
            >
              Cancel
            </button>
            <button
              className="btn btn-dark"
              type="submit"
              disabled={saving || readingEditImage || !adminId}
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </Modal.Footer>
        </form>
      </Modal>

      <Modal
        show={deletingProduct !== null}
        onHide={() => {
          if (!deleting) setDeletingProduct(null);
        }}
        backdrop="static"
        centered
        aria-labelledby="delete-product-title"
        aria-describedby="delete-product-description"
      >
        <Modal.Header closeButton={!deleting}>
          <Modal.Title id="delete-product-title">Delete product</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalError && <div className="alert alert-danger" role="alert">{modalError}</div>}
          <p id="delete-product-description" className="mb-0 text-break">
            Delete <strong>{deletingProduct?.name}</strong>? This action cannot be undone.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <button
            className="btn btn-outline-secondary"
            type="button"
            disabled={deleting}
            onClick={() => setDeletingProduct(null)}
          >
            Cancel
          </button>
          <button
            className="btn btn-danger"
            type="button"
            disabled={deleting || !adminId}
            onClick={() => void handleDelete()}
          >
            {deleting ? 'Deleting...' : 'Delete product'}
          </button>
        </Modal.Footer>
      </Modal>
    </section>
  );
};
