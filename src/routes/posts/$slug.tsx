import { createFileRoute, notFound } from "@tanstack/react-router";
import { Streamdown } from "streamdown";
import { getPostBySlug } from "@/lib/markdown";

export const Route = createFileRoute("/posts/$slug")({
  loader: async ({ params }) => {
    const post = getPostBySlug(params.slug);
    if (!post) {
      throw notFound();
    }
    return post;
  },
  component: PostPage,
});

function PostPage() {
  const post = Route.useLoaderData();

  return (
    <article className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto">
        {post.metadata.heroImage && (
          <div className="w-full h-64 md:h-96 overflow-hidden pt-8">
            <img
              src={post.metadata.heroImage}
              alt={post.metadata.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className=" py-12">
          <header className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              {post.metadata.title}
            </h1>
            {post.metadata.date && (
              <time
                dateTime={post.metadata.date}
                className="text-gray-400 text-lg"
              >
                {new Date(post.metadata.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            )}
          </header>

          <div className="prose prose-invert prose-lg max-w-none">
            <div className="text-gray-200">
              <Streamdown mode="static">{post.content}</Streamdown>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
