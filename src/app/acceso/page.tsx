import { AccesoForm } from './AccesoForm';

export const metadata = { title: 'Crear contraseña · Plinth' };

// Landing page of the link the owner sends after approving an access request.
// The token is only spent when the form is submitted (see accept-invite).
export default async function AccesoPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; token_hash?: string | string[]; type?: string | string[] }>;
}) {
  const { token, token_hash, type } = await searchParams;
  return (
    <AccesoForm
      token={typeof token === 'string' ? token : ''}
      tokenHash={typeof token_hash === 'string' ? token_hash : ''}
      type={typeof type === 'string' ? type : ''}
    />
  );
}
