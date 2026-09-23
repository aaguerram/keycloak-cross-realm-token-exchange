// Banca Empresa: consulta de un cliente (clientes-api solo permite la consulta por identificación),
// cuentas (todas las operaciones de cuentas-api) y movimientos (todas las de movimiento-api)
import { Fragment } from 'react';
import { CadenaTokens } from '@/components/cadena-tokens';
import { Permisos } from '@/components/permisos';
import { Result, Section, date, money } from '@/components/ui';
import { callApi } from '@/lib/gateway';
import { operations } from '@/lib/operations';
import type { Account, PartyDetail, Transaction } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Search = { id?: string; cuenta?: string; mov?: string };

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const id = (params.id ?? '1790012345001').trim();
  const p = encodeURIComponent(id);

  const [party, savings, current] = await Promise.all([
    callApi<{ Party: PartyDetail }>('cliente', `/party-reference-data-directory/v1/parties/${p}`),
    callApi<{ SavingsAccounts: Account[] }>('cuenta', `/savings-account/v1/parties/${p}/savings-accounts`),
    callApi<{ CurrentAccounts: Account[] }>('cuenta', `/current-account/v1/parties/${p}/current-accounts`),
  ]);
  const accounts = [...(current.data?.CurrentAccounts ?? []), ...(savings.data?.SavingsAccounts ?? [])];
  const cuenta = (params.cuenta ?? accounts[0]?.AccountIdentification.Identification ?? '').trim();

  const transactions = cuenta
    ? await callApi<{ Transactions: Transaction[]; Pagination: { TotalRecords: number } }>(
        'cuenta',
        `/position-keeping/v1/accounts/${encodeURIComponent(cuenta)}/transactions?limit=20`,
      )
    : undefined;
  const mov = (params.mov ?? transactions?.data?.Transactions[0]?.TransactionIdentification ?? '').trim();
  const transaction = mov ? await callApi<{ Transaction: Transaction }>('cuenta', `/position-keeping/v1/transactions/${encodeURIComponent(mov)}`) : undefined;

  const link = (q: Search) => `?${new URLSearchParams({ id, ...q } as Record<string, string>)}`;
  const firstOf = (list: Account[] | undefined, fallback: string) => list?.[0]?.AccountIdentification.Identification ?? fallback;

  return (
    <>
      <main>
        <section className="card">
          <form className="search">
            <label>
              Identificación (RUC o cédula)
              <input name="id" defaultValue={id} />
            </label>
            <button type="submit">Consultar</button>
          </form>
        </section>

        <div className="grid-2">
          <Section title="Cliente" scope="party:read">
            <Result result={party}>
              {({ Party }) => (
                <dl className="kv">
                  <dt>Razón social</dt>
                  <dd>{Party.PartyReference.PartyName.LegalName ?? Party.PartyReference.PartyName.Name}</dd>
                  <dt>Identificación</dt>
                  <dd>
                    {Party.PartyReference.PartyIdentification.Identification} ({Party.PartyReference.PartyIdentification.IdentificationType},{' '}
                    {Party.PartyReference.PartyIdentification.Issuer})
                  </dd>
                  <dt>Tipo</dt>
                  <dd>{Party.PartyReference.PartyType}</dd>
                  <dt>Estado</dt>
                  <dd>{Party.PartyLifecycleStatus}</dd>
                  {Party.DateOfIncorporation && (<><dt>Constitución</dt><dd>{Party.DateOfIncorporation}</dd></>)}
                  {Party.ContactPoint?.map((c) => (
                    <Fragment key={c.ContactPointType}><dt>{c.ContactPointType}</dt><dd>{c.Value}</dd></Fragment>
                  ))}
                </dl>
              )}
            </Result>
          </Section>

          <Section title="Cuentas" scope="current-account:read · savings-account:read">
            {current.status >= 300 && <Result result={current}>{() => null}</Result>}
            {savings.status >= 300 && <Result result={savings}>{() => null}</Result>}
            {accounts.length === 0 ? (
              <p className="hint">Sin cuentas.</p>
            ) : (
              <table>
                <thead>
                  <tr><th>Cuenta</th><th>Producto</th><th>Estado</th><th className="num">Disponible</th></tr>
                </thead>
                <tbody>
                  {accounts.map((a) => {
                    const n = a.AccountIdentification.Identification;
                    return (
                      <tr key={n}>
                        <td>{n === cuenta ? <strong>{n}</strong> : <a href={link({ cuenta: n })}>{n}</a>}</td>
                        <td>{a.ProductReference.ProductName}</td>
                        <td>{a.AccountStatus}</td>
                        <td className="num">{money(a.AvailableBalance.Amount, a.AvailableBalance.CreditDebitIndicator)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Section>
        </div>

        <div className="grid-2">
          <Section title={`Movimientos${cuenta ? ` de la cuenta ${cuenta}` : ''}`} scope="transaction:list">
            {transactions ? (
              <Result result={transactions}>
                {({ Transactions, Pagination }) => (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Fecha</th><th>Descripción</th><th>Estado</th><th className="num">Monto</th></tr>
                      </thead>
                      <tbody>
                        {Transactions.map((t) => (
                          <tr key={t.TransactionIdentification}>
                            <td>{date(t.BookingDate)}</td>
                            <td>
                              {t.TransactionIdentification === mov ? <strong>{t.TransactionDescription}</strong> : (
                                <a href={link({ cuenta, mov: t.TransactionIdentification })}>{t.TransactionDescription}</a>
                              )}
                            </td>
                            <td>{t.Status}</td>
                            <td className={`num ${t.CreditDebitIndicator.toLowerCase()}`}>{money(t.Amount, t.CreditDebitIndicator)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="hint">{Transactions.length} de {Pagination.TotalRecords} movimientos</p>
                  </div>
                )}
              </Result>
            ) : (
              <p className="hint">Seleccione una cuenta.</p>
            )}
          </Section>

          <Section title="Detalle de movimiento" scope="transaction:read">
            {transaction ? (
              <Result result={transaction}>
                {({ Transaction: t }) => (
                  <dl className="kv">
                    <dt>Movimiento</dt>
                    <dd><code>{t.TransactionIdentification}</code></dd>
                    <dt>Fecha</dt>
                    <dd>{date(t.BookingDate)}</dd>
                    <dt>Descripción</dt>
                    <dd>{t.TransactionDescription}</dd>
                    <dt>Canal</dt>
                    <dd>{t.Channel}</dd>
                    <dt>Monto</dt>
                    <dd className={t.CreditDebitIndicator.toLowerCase()}>{money(t.Amount, t.CreditDebitIndicator)}</dd>
                    <dt>Estado</dt>
                    <dd>{t.Status}</dd>
                    {t.BalanceAfterTransaction && (<><dt>Saldo posterior</dt><dd>{money(t.BalanceAfterTransaction.Amount)}</dd></>)}
                  </dl>
                )}
              </Result>
            ) : (
              <p className="hint">Seleccione un movimiento.</p>
            )}
          </Section>
        </div>

        <Permisos
          operations={operations({
            party: id,
            savings: firstOf(savings.data?.SavingsAccounts, '2200145678'),
            current: firstOf(current.data?.CurrentAccounts, '1100567890'),
            account: cuenta || '1100567890',
            transaction: mov || 'MOV-20260905-000027',
          })}
        />
        <CadenaTokens />
      </main>
    </>
  );
}
