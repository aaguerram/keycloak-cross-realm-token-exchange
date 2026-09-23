'use client';
import { useState } from 'react';
import { ConsultaCard } from '@/components/consulta-card';
import { date, money } from '@/components/ui';
import type { Account, Address, Balance, CurrentAccountFacility, SavingsAccountFacility } from '@/lib/types';
import {
  consultarCliente,
  consultarCuentaAhorro,
  consultarCuentaCorriente,
  consultarCuentasAhorro,
  consultarCuentasCorrientes,
  consultarDirecciones,
  consultarMovimiento,
  consultarMovimientosCuenta,
} from '../actions';

const TYPES: Record<string, string> = { NIDN: 'Cédula', TXID: 'RUC', CCPT: 'Pasaporte' };
const ADDRESS_TYPES: Record<string, string> = { HOME: 'Domicilio', BIZZ: 'Trabajo / negocio', DLVY: 'Entrega', MLTO: 'Correspondencia' };

const BALANCE_TYPES: Record<string, string> = { ITAV: 'Disponible', ITBD: 'Contable', CLBD: 'Cierre', OPBD: 'Apertura' };
const STATUS: Record<string, string> = { ENAB: 'Activa', DISA: 'Inactiva', DELE: 'Cerrada', PRCD: 'En proceso' };

export function Detalle({ id }: { id: string }) {
  const [ahorro, setAhorro] = useState('');
  const [corriente, setCorriente] = useState('');
  const [movimiento, setMovimiento] = useState('');
  const [cuenta, setCuenta] = useState('');

  return (
    <>
      <ConsultaCard
        title="Datos del cliente"
        product="cliente"
        scope="party:read"
        endpoint={`GET /party-reference-data-directory/v1/parties/${id}`}
        consultar={() => consultarCliente(id)}
      >
        {({ Party }) => {
          const ref = Party.PartyReference;
          return (
            <div className="grid-2 cards">
              <div>
                <h3>Datos generales</h3>
                <dl className="kv">
                  <dt>Nombre</dt>
                  <dd>{ref.PartyName.LegalName ?? ref.PartyName.Name}</dd>
                  {ref.PartyName.GivenName && (<><dt>Nombres</dt><dd>{ref.PartyName.GivenName}</dd></>)}
                  {ref.PartyName.FamilyName && (<><dt>Apellidos</dt><dd>{ref.PartyName.FamilyName}</dd></>)}
                  {ref.PartyName.LegalName && (<><dt>Nombre comercial</dt><dd>{ref.PartyName.Name}</dd></>)}
                  <dt>Tipo de cliente</dt>
                  <dd>{ref.PartyType === 'Individual' ? 'Persona natural' : 'Persona jurídica'} ({ref.PartyType})</dd>
                  <dt>Identificación</dt>
                  <dd>
                    {TYPES[ref.PartyIdentification.IdentificationType] ?? ref.PartyIdentification.IdentificationType} {ref.PartyIdentification.Identification}
                  </dd>
                  <dt>Emisor</dt>
                  <dd>{ref.PartyIdentification.Issuer}</dd>
                  <dt>Estado</dt>
                  <dd><span className={`badge ${Party.PartyLifecycleStatus === 'Active' ? 'ok' : 'no'}`}>{Party.PartyLifecycleStatus}</span></dd>
                  {Party.DateOfBirth && (<><dt>Fecha de nacimiento</dt><dd>{Party.DateOfBirth}</dd></>)}
                  {Party.DateOfIncorporation && (<><dt>Constitución</dt><dd>{Party.DateOfIncorporation}</dd></>)}
                  {Party.Nationality && (<><dt>Nacionalidad</dt><dd>{Party.Nationality}</dd></>)}
                  <dt>Referencia</dt>
                  <dd><code>{Party.PartyReferenceDataDirectoryEntryReference}</code></dd>
                </dl>
              </div>
              <div>
                <h3>Contacto</h3>
                {Party.ContactPoint?.length ? (
                  <dl className="kv">
                    {Party.ContactPoint.map((c) => (
                      <Pair key={c.ContactPointType} label={c.ContactPointType} value={c.Value} />
                    ))}
                  </dl>
                ) : (
                  <p className="hint">Sin datos de contacto.</p>
                )}
              </div>
            </div>
          );
        }}
      </ConsultaCard>

      <ConsultaCard
        title="Direcciones del cliente"
        product="cliente"
        scope="party-address:read"
        endpoint={`GET /party-reference-data-directory/v1/parties/${id}/addresses`}
        consultar={() => consultarDirecciones(id)}
      >
        {({ PartyName, PostalAddress, TotalRecords }) => (
          <>
            <p className="hint">{PartyName} · {TotalRecords} direcciones</p>
            <Addresses list={PostalAddress} />
          </>
        )}
      </ConsultaCard>

      <ConsultaCard
        title="Cuentas de ahorro del cliente"
        product="cuenta"
        scope="savings-account:read"
        endpoint={`GET /savings-account/v1/parties/${id}/savings-accounts`}
        consultar={() => consultarCuentasAhorro(id)}
      >
        {({ SavingsAccounts }) => <Accounts list={SavingsAccounts} onSelect={setAhorro} target="Detalle de cuenta de ahorro" />}
      </ConsultaCard>

      <ConsultaCard
        title="Detalle de cuenta de ahorro"
        product="cuenta"
        scope="savings-account:read"
        endpoint={`GET /savings-account/v1/savings-accounts/${ahorro || '{savingsAccountId}'}`}
        consultar={() => consultarCuentaAhorro(ahorro)}
        controls={<Field label="Número de cuenta de ahorro" value={ahorro} onChange={setAhorro} placeholder="p. ej. 2200145678" />}
        disabledReason={ahorro.trim() ? undefined : 'Ingrese el número de cuenta o selecciónelo en la lista de cuentas de ahorro.'}
      >
        {({ SavingsAccountFacility: a }) => <SavingsDetail account={a} />}
      </ConsultaCard>

      <ConsultaCard
        title="Cuentas corrientes del cliente"
        product="cuenta"
        scope="current-account:read"
        endpoint={`GET /current-account/v1/parties/${id}/current-accounts`}
        consultar={() => consultarCuentasCorrientes(id)}
      >
        {({ CurrentAccounts }) => <Accounts list={CurrentAccounts} onSelect={setCorriente} target="Detalle de cuenta corriente" />}
      </ConsultaCard>

      <ConsultaCard
        title="Detalle de cuenta corriente"
        product="cuenta"
        scope="current-account:read"
        endpoint={`GET /current-account/v1/current-accounts/${corriente || '{currentAccountId}'}`}
        consultar={() => consultarCuentaCorriente(corriente)}
        controls={<Field label="Número de cuenta corriente" value={corriente} onChange={setCorriente} placeholder="p. ej. 1100456789" />}
        disabledReason={corriente.trim() ? undefined : 'Ingrese el número de cuenta o selecciónelo en la lista de cuentas corrientes.'}
      >
        {({ CurrentAccountFacility: a }) => <CurrentDetail account={a} />}
      </ConsultaCard>

      <ConsultaCard
        title="Movimientos de una cuenta"
        product="cuenta"
        scope="transaction:list"
        endpoint={`GET /position-keeping/v1/accounts/${cuenta || '{accountId}'}/transactions?limit=10`}
        consultar={() => consultarMovimientosCuenta(cuenta)}
        controls={<Field label="Número de cuenta" value={cuenta} onChange={setCuenta} placeholder="p. ej. 2200145678" />}
        disabledReason={cuenta.trim() ? undefined : 'Ingrese el número de cuenta (ahorro o corriente).'}
      >
        {({ Transactions, Pagination }) => (
          <>
            <p className="hint">{Pagination.TotalRecords} movimientos</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Movimiento</th><th>Fecha</th><th>Descripción</th><th className="num">Monto</th></tr>
                </thead>
                <tbody>
                  {Transactions.map((t) => (
                    <tr key={t.TransactionIdentification}>
                      <td><code>{t.TransactionIdentification}</code></td>
                      <td>{date(t.BookingDate)}</td>
                      <td>{t.TransactionDescription}</td>
                      <td className={`num ${t.CreditDebitIndicator.toLowerCase()}`}>{money(t.Amount, t.CreditDebitIndicator)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ConsultaCard>

      <ConsultaCard
        title="Detalle de movimiento"
        product="cuenta"
        scope="transaction:read"
        endpoint={`GET /position-keeping/v1/transactions/${movimiento || '{transactionId}'}`}
        consultar={() => consultarMovimiento(movimiento)}
        controls={<Field label="ID del movimiento" value={movimiento} onChange={setMovimiento} placeholder="p. ej. MOV-20260905-000027" />}
        disabledReason={movimiento.trim() ? undefined : 'Ingrese el ID del movimiento (MOV-AAAAMMDD-NNNNNN).'}
      >
        {({ Transaction: t }) => (
          <dl className="kv">
            <dt>Movimiento</dt>
            <dd><code>{t.TransactionIdentification}</code></dd>
            <dt>Cuenta</dt>
            <dd>{t.AccountIdentification?.Identification}</dd>
            <dt>Fecha contable</dt>
            <dd>{date(t.BookingDate)}</dd>
            <dt>Descripción</dt>
            <dd>{t.TransactionDescription}</dd>
            <dt>Canal</dt>
            <dd>{t.Channel ?? '—'}</dd>
            <dt>Monto</dt>
            <dd className={t.CreditDebitIndicator.toLowerCase()}>
              {money(t.Amount, t.CreditDebitIndicator)} ({t.CreditDebitIndicator === 'CRDT' ? 'crédito' : 'débito'})
            </dd>
            <dt>Estado</dt>
            <dd>{t.Status === 'BOOK' ? 'Contabilizado' : t.Status === 'PDNG' ? 'Pendiente' : t.Status} ({t.Status})</dd>
            {t.BalanceAfterTransaction && (<><dt>Saldo posterior</dt><dd>{money(t.BalanceAfterTransaction.Amount)}</dd></>)}
          </dl>
        )}
      </ConsultaCard>
    </>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label>
      {label}
      <input value={value} onChange={(ev) => onChange(ev.target.value)} placeholder={placeholder} />
    </label>
  );
}

function Accounts({ list, onSelect, target }: { list: Account[]; onSelect: (n: string) => void; target: string }) {
  if (!list.length) return <p className="hint">El cliente no tiene cuentas de este tipo.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Cuenta</th><th>Nombre</th><th>Producto</th><th>Estado</th><th className="num">Disponible</th><th /></tr>
        </thead>
        <tbody>
          {list.map((a) => {
            const n = a.AccountIdentification.Identification;
            return (
              <tr key={n}>
                <td>{n}</td>
                <td>{a.AccountName}</td>
                <td>{a.ProductReference.ProductName}</td>
                <td>{STATUS[a.AccountStatus] ?? a.AccountStatus}</td>
                <td className="num">{money(a.AvailableBalance.Amount, a.AvailableBalance.CreditDebitIndicator)}</td>
                <td><button type="button" className="link" onClick={() => onSelect(n)} title={`Copiar a "${target}"`}>Usar en detalle</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Balances({ list }: { list: Balance[] }) {
  return (
    <table>
      <tbody>
        {list.map((b) => (
          <tr key={b.BalanceType}>
            <td>{BALANCE_TYPES[b.BalanceType] ?? b.BalanceType} <code>{b.BalanceType}</code></td>
            <td className="num">{money(b.Amount, b.CreditDebitIndicator)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AccountGeneral({ account: a }: { account: SavingsAccountFacility | CurrentAccountFacility }) {
  return (
    <div>
      <h3>Cuenta</h3>
      <dl className="kv">
        <dt>Número</dt>
        <dd>{a.AccountIdentification.Identification} ({a.AccountIdentification.SchemeName})</dd>
        <dt>Nombre</dt>
        <dd>{a.AccountName}</dd>
        <dt>Producto</dt>
        <dd>{a.ProductReference.ProductName} <code>{a.ProductReference.ProductIdentification}</code></dd>
        <dt>Tipo</dt>
        <dd>{a.AccountType}</dd>
        <dt>Estado</dt>
        <dd>{STATUS[a.AccountStatus] ?? a.AccountStatus} ({a.AccountStatus})</dd>
        <dt>Moneda</dt>
        <dd>{a.AccountCurrency}</dd>
        <dt>Titular</dt>
        <dd>{a.CustomerReference.PartyName} · {a.CustomerReference.PartyIdentification.Identification}</dd>
        <dt>Oficina</dt>
        <dd>{a.Servicer.Name} · {a.Servicer.BranchName} ({a.Servicer.BICFI})</dd>
        <dt>Apertura</dt>
        <dd>{a.OpeningDate}</dd>
        {a.LastActivityDate && (<><dt>Última actividad</dt><dd>{a.LastActivityDate}</dd></>)}
        {a.StatementFrequency && (<><dt>Estado de cuenta</dt><dd>{a.StatementFrequency}</dd></>)}
      </dl>
    </div>
  );
}

function SavingsDetail({ account: a }: { account: SavingsAccountFacility }) {
  return (
    <div className="subgrid">
      <AccountGeneral account={a} />
      <div>
        <h3>Saldos</h3>
        <Balances list={a.Balance} />
        {a.InterestRate && (
          <>
            <h3>Interés</h3>
            <dl className="kv">
              <dt>Tasa anual</dt>
              <dd>{a.InterestRate.AnnualRate}% ({a.InterestRate.RateType}, {a.InterestRate.DayCountBasis})</dd>
              <dt>Pago</dt>
              <dd>{a.InterestRate.PaymentFrequency}</dd>
              {a.InterestRate.AccruedInterest && (<><dt>Interés devengado</dt><dd>{money(a.InterestRate.AccruedInterest)}</dd></>)}
            </dl>
          </>
        )}
        {a.SavingsAccountFeatures && (
          <>
            <h3>Condiciones</h3>
            <dl className="kv">
              {a.SavingsAccountFeatures.MinimumBalance && (<><dt>Saldo mínimo</dt><dd>{money(a.SavingsAccountFeatures.MinimumBalance)}</dd></>)}
              {a.SavingsAccountFeatures.DailyWithdrawalLimit && (<><dt>Retiro diario máx.</dt><dd>{money(a.SavingsAccountFeatures.DailyWithdrawalLimit)}</dd></>)}
              {a.SavingsAccountFeatures.MonthlyWithdrawalCountLimit !== undefined && (<><dt>Retiros al mes</dt><dd>{a.SavingsAccountFeatures.MonthlyWithdrawalCountLimit}</dd></>)}
            </dl>
          </>
        )}
      </div>
    </div>
  );
}

function CurrentDetail({ account: a }: { account: CurrentAccountFacility }) {
  return (
    <div className="subgrid">
      <AccountGeneral account={a} />
      <div>
        <h3>Saldos</h3>
        <Balances list={a.Balance} />
        {a.OverdraftFacility && (
          <>
            <h3>Sobregiro</h3>
            <dl className="kv">
              <dt>Cupo</dt>
              <dd>{money(a.OverdraftFacility.OverdraftLimit)}</dd>
              <dt>Utilizado</dt>
              <dd>{money(a.OverdraftFacility.OverdraftUsed)}</dd>
              {a.OverdraftFacility.OverdraftInterestRate && (<><dt>Tasa anual</dt><dd>{a.OverdraftFacility.OverdraftInterestRate.AnnualRate}%</dd></>)}
            </dl>
          </>
        )}
        {a.ChequeBook && (
          <>
            <h3>Chequera</h3>
            <dl className="kv">
              <dt>Habilitada</dt>
              <dd>{a.ChequeBook.ChequeBookEnabled ? 'Sí' : 'No'}</dd>
              {a.ChequeBook.LastChequeBookIssueDate && (<><dt>Última emisión</dt><dd>{a.ChequeBook.LastChequeBookIssueDate}</dd></>)}
              {a.ChequeBook.ChequeNumberRange && (<><dt>Numeración</dt><dd>{a.ChequeBook.ChequeNumberRange.From} – {a.ChequeBook.ChequeNumberRange.To}</dd></>)}
            </dl>
          </>
        )}
        {a.ServiceCharge && (
          <>
            <h3>Cargos</h3>
            <dl className="kv">
              <dt>Mantenimiento</dt>
              <dd>{money(a.ServiceCharge.MonthlyMaintenanceFee)} ({a.ServiceCharge.ChargeFrequency})</dd>
            </dl>
          </>
        )}
      </div>
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function Addresses({ list }: { list: Address[] }) {
  if (!list.length) return <p className="hint">Sin direcciones registradas.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Tipo</th><th>Dirección</th><th>Edificio</th><th>Ciudad</th><th>Provincia</th><th>Código postal</th><th>País</th></tr>
        </thead>
        <tbody>
          {list.map((a, i) => (
            <tr key={i}>
              <td>{ADDRESS_TYPES[a.AddressType] ?? a.AddressType} <code>{a.AddressType}</code></td>
              <td>{a.AddressLine?.join(', ') ?? `${a.StreetName ?? ''} ${a.BuildingNumber ?? ''}`}</td>
              <td>{[a.BuildingName, a.Floor && `piso ${a.Floor}`].filter(Boolean).join(', ') || '—'}</td>
              <td>{a.TownName}</td>
              <td>{a.CountrySubDivision}</td>
              <td>{a.PostCode ?? '—'}</td>
              <td>{a.Country}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
