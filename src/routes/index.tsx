import { createFileRoute, Link } from "@tanstack/react-router";
import { getAllPosts } from "@/lib/markdown";
import type { Post } from "@/lib/markdown";

export const Route = createFileRoute("/")({
  loader: async () => {
    return getAllPosts();
  },
  component: HomePage,
});

function HomePage() {
  const posts = Route.useLoaderData() as Post[];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-12 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
            Blog
          </h1>
          <p className="text-xl text-gray-400">
            Welcome to my blog. Here are all my posts.
          </p>
        </header>

        {posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">
              No posts yet. Create a markdown file in the{" "}
              <code className="px-2 py-1 bg-slate-700 rounded text-cyan-400">
                /posts/
              </code>{" "}
              directory to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl overflow-hidden hover:border-cyan-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10 h-full"
              >
                <Link
                  to="/posts/$slug"
                  params={{ slug: post.slug }}
                  className="block"
                >
                  {post.metadata.heroImage && (
                    <div className="w-full h-48 md:h-64 overflow-hidden">
                      <img
                        src={post.metadata.heroImage}
                        alt={post.metadata.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    <h2 className="text-2xl font-semibold text-white mb-2 hover:text-cyan-400 transition-colors">
                      {post.metadata.title}
                    </h2>
                    {post.metadata.date && (
                      <time
                        dateTime={post.metadata.date}
                        className="text-gray-400 text-sm block mb-3"
                      >
                        {new Date(post.metadata.date).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }
                        )}
                      </time>
                    )}
                    {post.metadata.description && (
                      <p className="text-gray-300 leading-relaxed">
                        {post.metadata.description}
                      </p>
                    )}
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
