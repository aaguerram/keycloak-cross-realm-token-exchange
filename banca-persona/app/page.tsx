// Banca Persona: consulta de clientes (todas las operaciones de clientes-api), cuentas (todas las de
// cuentas-api) y detalle de un movimiento (movimiento-api solo permite consultar un movimiento)
import { Fragment } from 'react';
import { CadenaTokens } from '@/components/cadena-tokens';
import { Permisos } from '@/components/permisos';
import { Result, Section, date, money } from '@/components/ui';
import { callApi } from '@/lib/gateway';
import { operations } from '@/lib/operations';
import type { Account, Address, PartyDetail, PartyEntry, Transaction } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Search = { id?: string; mov?: string };

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const id = (params.id ?? '1710034065').trim();
  const mov = (params.mov ?? 'MOV-20260905-000027').trim();
  const p = encodeURIComponent(id);

  const [parties, party, addresses, savings, current, transaction] = await Promise.all([
    callApi<{ Parties: PartyEntry[] }>('cliente', '/party-reference-data-directory/v1/parties'),
    callApi<{ Party: PartyDetail }>('cliente', `/party-reference-data-directory/v1/parties/${p}`),
    callApi<{ PostalAddress: Address[] }>('cliente', `/party-reference-data-directory/v1/parties/${p}/addresses`),
    callApi<{ SavingsAccounts: Account[] }>('cuenta', `/savings-account/v1/parties/${p}/savings-accounts`),
    callApi<{ CurrentAccounts: Account[] }>('cuenta', `/current-account/v1/parties/${p}/current-accounts`),
    callApi<{ Transaction: Transaction }>('cuenta', `/position-keeping/v1/transactions/${encodeURIComponent(mov)}`),
  ]);
  const firstSavings = savings.data?.SavingsAccounts[0]?.AccountIdentification.Identification ?? '2200145678';
  const firstCurrent = current.data?.CurrentAccounts[0]?.AccountIdentification.Identification ?? '1100456789';

  return (
    <>
      <main>
        <section className="card">
          <form className="search">
            <label>
              Identificación (cédula o RUC)
              <input name="id" defaultValue={id} />
            </label>
            <label>
              Movimiento
              <input name="mov" defaultValue={mov} />
            </label>
            <button type="submit">Consultar</button>
          </form>
        </section>

        <div className="grid-2">
          <Section title="Cliente" scope="party:read">
            <Result result={party}>
              {({ Party }) => (
                <dl className="kv">
                  <dt>Nombre</dt>
                  <dd>{Party.PartyReference.PartyName.Name}</dd>
                  <dt>Identificación</dt>
                  <dd>
                    {Party.PartyReference.PartyIdentification.Identification} ({Party.PartyReference.PartyIdentification.IdentificationType})
                  </dd>
                  <dt>Tipo</dt>
                  <dd>{Party.PartyReference.PartyType}</dd>
                  <dt>Estado</dt>
                  <dd>{Party.PartyLifecycleStatus}</dd>
                  {Party.ContactPoint?.map((c) => (
                    <Fragment key={c.ContactPointType}><dt>{c.ContactPointType}</dt><dd>{c.Value}</dd></Fragment>
                  ))}
                </dl>
              )}
            </Result>
          </Section>

          <Section title="Direcciones" scope="party-address:read">
            <Result result={addresses}>
              {({ PostalAddress }) => (
                <table>
                  <tbody>
                    {PostalAddress.map((a, i) => (
                      <tr key={i}>
                        <td><code>{a.AddressType}</code></td>
                        <td>{a.AddressLine?.join(', ')} — {a.TownName}, {a.CountrySubDivision}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Result>
          </Section>
        </div>

        <div className="grid-2">
          <Section title="Cuentas de ahorro" scope="savings-account:read">
            <Result result={savings}>{({ SavingsAccounts }) => <Accounts accounts={SavingsAccounts} />}</Result>
          </Section>
          <Section title="Cuentas corrientes" scope="current-account:read">
            <Result result={current}>{({ CurrentAccounts }) => <Accounts accounts={CurrentAccounts} />}</Result>
          </Section>
        </div>

        <div className="grid-2">
          <Section title="Detalle de movimiento" scope="transaction:read">
            <Result result={transaction}>
              {({ Transaction: t }) => (
                <dl className="kv">
                  <dt>Movimiento</dt>
                  <dd><code>{t.TransactionIdentification}</code></dd>
                  <dt>Cuenta</dt>
                  <dd>{t.AccountIdentification?.Identification}</dd>
                  <dt>Fecha</dt>
                  <dd>{date(t.BookingDate)}</dd>
                  <dt>Descripción</dt>
                  <dd>{t.TransactionDescription}</dd>
                  <dt>Monto</dt>
                  <dd className={t.CreditDebitIndicator.toLowerCase()}>{money(t.Amount, t.CreditDebitIndicator)}</dd>
                  <dt>Estado</dt>
                  <dd>{t.Status}</dd>
                  {t.BalanceAfterTransaction && (<><dt>Saldo posterior</dt><dd>{money(t.BalanceAfterTransaction.Amount)}</dd></>)}
                </dl>
              )}
            </Result>
          </Section>

          <Section title="Directorio de clientes" scope="party:list">
            <Result result={parties}>
              {({ Parties }) => (
                <table>
                  <tbody>
                    {Parties.map((e) => (
                      <tr key={e.PartyReferenceDataDirectoryEntryReference}>
                        <td><a href={`?id=${e.PartyReference.PartyIdentification.Identification}&mov=${encodeURIComponent(mov)}`}>{e.PartyReference.PartyIdentification.Identification}</a></td>
                        <td>{e.PartyReference.PartyName.Name}</td>
                        <td>{e.PartyLifecycleStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Result>
          </Section>
        </div>

        <Permisos operations={operations({ party: id, savings: firstSavings, current: firstCurrent, account: firstSavings, transaction: mov })} />
        <CadenaTokens />
      </main>
    </>
  );
}

function Accounts({ accounts }: { accounts: Account[] }) {
  if (accounts.length === 0) return <p className="hint">Sin cuentas.</p>;
  return (
    <table>
      <thead>
        <tr><th>Cuenta</th><th>Producto</th><th>Estado</th><th className="num">Disponible</th></tr>
      </thead>
      <tbody>
        {accounts.map((a) => (
          <tr key={a.AccountIdentification.Identification}>
            <td>{a.AccountIdentification.Identification}</td>
            <td>{a.ProductReference.ProductName}</td>
            <td>{a.AccountStatus}</td>
            <td className="num">{money(a.AvailableBalance.Amount, a.AvailableBalance.CreditDebitIndicator)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
