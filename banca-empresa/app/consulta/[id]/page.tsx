// Detalle de un cliente: una card por endpoint de clientes-api. Al entrar no se consulta nada; cada
// card trae su información con su propio botón.
import Link from 'next/link';
import { Detalle } from './detalle';

export default async function DetalleCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main>
      <p className="back">
        <Link href="/consulta">← Volver a la lista de clientes</Link>
      </p>
      <section className="card">
        <h2 className="title">Cliente {decodeURIComponent(id)}</h2>
      </section>
      <Detalle id={decodeURIComponent(id)} />
    </main>
  );
}
