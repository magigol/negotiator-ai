import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-12 py-32 px-16 bg-white dark:bg-black sm:items-start">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <Image
            className="dark:invert"
            src="/next.svg"
            alt="Logo"
            width={40}
            height={40}
          />
          <span className="text-xl font-bold text-black dark:text-white">
            Negotiator AI
          </span>
        </div>

        {/* Hero */}
        <div className="flex flex-col gap-6 text-center sm:text-left">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-black dark:text-zinc-50">
            Negocia mejor. Automáticamente.
          </h1>

          <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Publica tus productos y deja que la inteligencia artificial
            negocie por ti hasta llegar al mejor acuerdo posible.
          </p>
        </div>

        {/* Botones */}
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">

          {/* 👉 BOTÓN TIENDA */}
          <Link
            href="/shop"
            className="flex h-12 w-full items-center justify-center rounded-full bg-black text-white px-6 transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-300 md:w-[180px]"
          >
            Ver tienda
          </Link>

          {/* 👉 BOTÓN CREAR */}
          <Link
            href="/create"
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/20 px-6 transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10 md:w-[180px]"
          >
            Publicar producto
          </Link>

        </div>

      </main>
    </div>
  );
}