import { Link } from "@tanstack/react-router";

export default function Header() {
  return (
    <header className="p-4 flex items-center justify-between bg-gray-800 text-white shadow-lg">
      <nav>
        <Link
          to="/"
          className="text-xl font-semibold hover:text-cyan-400 transition-colors"
        >
          Kieren Foenander
        </Link>
      </nav>
    </header>
  );
}
