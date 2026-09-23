'use client';
// Lista de clientes: al seleccionar un cliente se abre su página de detalle. Si el canal no puede
// listar clientes, también se puede abrir el detalle escribiendo la identificación.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConsultaCard } from '@/components/consulta-card';
import { listarClientes } from './actions';

export function Consulta() {
  const router = useRouter();
  const [id, setId] = useState('');
  return (
    <>
      <section className="card">
        <form
          className="search"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (id.trim()) router.push(`/consulta/${encodeURIComponent(id.trim())}`);
          }}
        >
          <label>
            Identificación del cliente (cédula o RUC)
            <input value={id} onChange={(ev) => setId(ev.target.value)} placeholder="p. ej. 1710034065" />
          </label>
          <button type="submit" disabled={!id.trim()}>Ver detalle</button>
        </form>
      </section>
      <ConsultaCard title="Lista de clientes" product="cliente" scope="party:list" endpoint="GET /party-reference-data-directory/v1/parties" consultar={listarClientes}>
        {({ Parties, TotalRecords }) => (
          <div className="table-wrap">
            <table className="selectable">
              <thead>
                <tr><th>Identificación</th><th>Nombre</th><th>Tipo</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {Parties.map((p) => {
                  const id = p.PartyReference.PartyIdentification.Identification;
                  return (
                    <tr key={p.PartyReferenceDataDirectoryEntryReference}>
                      <td><Link href={`/consulta/${id}`}>{id}</Link></td>
                      <td><Link href={`/consulta/${id}`}>{p.PartyReference.PartyName.Name}</Link></td>
                      <td>{p.PartyReference.PartyType}</td>
                      <td>{p.PartyLifecycleStatus}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="hint">{TotalRecords} clientes · seleccione un cliente para ver su detalle</p>
          </div>
        )}
      </ConsultaCard>
    </>
  );
}
