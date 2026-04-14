import { GeneratorForm } from '../components/generator-form';

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10 text-zinc-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="space-y-3">
          <p className="text-sm font-medium text-emerald-600">微信图文 demo</p>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
            本地公众号图文生成软件
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-zinc-600 sm:text-base">
            你只需要输入文章主题和少量要求，系统会自动生成公众号文章、配图提示词并调用 DeerAPI 生图，最后把结果保存到本地目录，方便你手动检查和上传发布。
          </p>
        </header>

        <GeneratorForm />
      </div>
    </main>
  );
}
