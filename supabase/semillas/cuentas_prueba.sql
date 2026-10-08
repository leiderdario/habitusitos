-- Cuentas de prueba para trabajar en local: una de modo personal y una de modo oficina.
--
-- Ejecutar en el SQL Editor del dashboard de Supabase (rol dueno), DESPUES de las
-- migraciones 0001 a 0006. Se puede ejecutar varias veces: si las cuentas ya
-- existen, solo les cambia la contrasena. Para borrarlas, ver el final del archivo.
--
-- POR QUE EXISTE: con "Confirm email" activado (es lo que trae Supabase por defecto),
-- registrarse desde la aplicacion crea la cuenta pero NO abre sesion hasta confirmar el
-- correo; entonces el insert del perfil en `usuarios` lo rechaza la policy (auth.uid()
-- es null) y la pantalla muestra un error enganoso de "No pudimos guardar tu historial".
-- Estas cuentas se crean ya confirmadas, con su perfil, y entran sin pasar por el registro.
--
-- LA CONTRASENA SE GENERA AL AZAR en cada ejecucion y solo aparece en el resultado de la
-- ultima consulta de este script. No esta (ni debe estar) escrita en el repositorio: la
-- base de datos de desarrollo y la de produccion son la misma, y una contrasena fija en el
-- codigo seria una puerta abierta para cualquiera que lo lea.
--
-- NO crea consentimientos ni antecedentes de salud: al entrar por primera vez la cuenta
-- pasa por la pantalla de consentimiento como cualquier persona. Registrar una aceptacion
-- que nadie dio sobre textos que aun no revisa el comite de etica seria falsificarla.
--
-- Los correos usan example.com (dominio reservado, no recibe correo).

drop table if exists cuentas_prueba_resultado;
create temp table cuentas_prueba_resultado (correo text, contrasena text, modo_uso text);

do $$
declare
  v_cuenta record;
  v_id uuid;
  v_clave text;
begin
  for v_cuenta in
    select * from (values
      ('prueba.personal@example.com', 'Prueba personal', 'personal'),
      ('prueba.oficina@example.com',  'Prueba oficina',  'oficina')
    ) as t (correo, nombre, modo_uso)
  loop
    -- 16 caracteres hexadecimales al azar (64 bits): de sobra para una cuenta de prueba.
    v_clave := substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);

    select id into v_id from auth.users where email = v_cuenta.correo;

    if v_id is null then
      v_id := gen_random_uuid();

      -- Los campos *_token van como '' y no como null: GoTrue falla al leer la cuenta
      -- ("Database error querying schema") si encuentra null en ellos.
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
        v_cuenta.correo, crypt(v_clave, gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('nombre', v_cuenta.nombre, 'modo_uso', v_cuenta.modo_uso),
        now(), now(), '', '', '', ''
      );

      -- Sin la fila en auth.identities, el inicio de sesion con correo y contrasena no
      -- reconoce la cuenta.
      insert into auth.identities (
        id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), v_id::text, v_id,
        jsonb_build_object('sub', v_id::text, 'email', v_cuenta.correo, 'email_verified', true),
        'email', now(), now(), now()
      );
    else
      update auth.users
         set encrypted_password = crypt(v_clave, gen_salt('bf')),
             email_confirmed_at = coalesce(email_confirmed_at, now()),
             updated_at = now()
       where id = v_id;
    end if;

    -- El correo del perfil lo fija el trigger usuarios_fijar_correo desde auth.users.
    -- `rol` queda en 'trabajador' y `organizacion_id` en null: se cambian desde aqui.
    insert into usuarios (id, nombre, modo_uso)
    values (v_id, v_cuenta.nombre, v_cuenta.modo_uso)
    on conflict (id) do update set nombre = excluded.nombre, modo_uso = excluded.modo_uso;

    insert into cuentas_prueba_resultado values (v_cuenta.correo, v_clave, v_cuenta.modo_uso);
  end loop;
end $$;

-- Copia el correo y la contrasena de estas dos filas.
select correo, contrasena, modo_uso from cuentas_prueba_resultado order by modo_uso desc;

-- Para BORRAR las cuentas de prueba (el perfil y lo que cuelga de el se van en cascada):
--   delete from auth.users where email in ('prueba.personal@example.com', 'prueba.oficina@example.com');

-- SI EL INICIO DE SESION FALLA con estas cuentas ("Invalid login credentials" o "Database error querying
-- schema"): este script escribe a mano en las tablas internas de auth, que es lo mas delicado de la semilla y
-- depende de la version de Supabase. Alternativa soportada por el dashboard:
--   1. Borrar las cuentas con el delete de arriba.
--   2. Authentication > Users > Add user > Create new user, con correo y contrasena y "Auto Confirm User" marcado.
--   3. Crear solo el perfil (ajustar el correo y el modo):
--        insert into usuarios (id, nombre, modo_uso)
--        select id, 'Prueba', 'personal' from auth.users where email = 'prueba.personal@example.com'
--        on conflict (id) do nothing;
