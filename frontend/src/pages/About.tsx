import { Link } from 'react-router-dom'
import SpotlightCard from '@/components/SpotlightCard'
import ShinyText from '@/components/ShinyText'
import SplitText from '@/components/SplitText'
import Galaxy from '@/components/Galaxy'
import MiniGame from '@/components/MiniGame'
import DuckHunt from '@/components/DuckHunt'
import { ArrowLeft } from 'lucide-react'

export default function About() {
  return (
    <div className="relative min-h-screen text-neutral-50 flex flex-col items-center justify-center font-sans px-6 py-12 selection:bg-indigo-500/30 overflow-y-auto z-10">
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-enter {
          animation: fadeSlideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
      `}</style>
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <Galaxy 
          mouseInteraction={false}
          density={1}
          glowIntensity={0.1}
          saturation={0.2}
          hueShift={140}
          twinkleIntensity={0.3}
          rotationSpeed={0.05}
          repulsionStrength={2}
          autoCenterRepulsion={0}
          starSpeed={1}
          speed={0.5}
        />
      </div>
      {/* Back Button */}
      <Link
        to="/"
        className="absolute top-6 left-6 md:top-8 md:left-8 w-12 h-12 rounded-full bg-neutral-900/60 border border-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all backdrop-blur-md z-50 hover:scale-105 active:scale-95"
        title="Voltar para o Início"
      >
        <ArrowLeft size={24} />
      </Link>

      <div className="relative z-10 w-full max-w-6xl p-8 md:p-10 flex flex-col gap-8 mt-auto mb-auto">

        <div className="flex flex-col items-center pb-2 gap-3">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-white">
            <SplitText text="Sobre o Jogo" delay={100} />
          </h1>
          <p className="text-sm font-semibold tracking-widest uppercase mt-2 animate-enter" style={{ animationDelay: '400ms' }}>
            <ShinyText text="Hackathon Codecon 2026" speed={2.5} className="text-emerald-400" />
          </p>
        </div>

        {/* Layout de Duas Colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 text-neutral-300 text-base leading-relaxed mt-4">

          {/* Coluna da Esquerda: Informações do Jogo */}
          <div className="space-y-10 flex flex-col text-justify">
            {/* O que é o 67? */}
            <section className="flex flex-col max-w-lg mx-auto animate-enter" style={{ animationDelay: '600ms' }}>
              <h2 className="text-2xl font-semibold tracking-tight mb-4 text-start">
                <ShinyText text="O que é o meme 67?" speed={3} className="text-white" />
              </h2>
              <p className="mb-4">
                Se você passa muito tempo no TikTok, já deve ter esbarrado na febre do "67" (ou <em>six-seven</em>). O meme nasceu de um vídeo de basquete e de um rap, se tornando o símbolo definitivo do humor "brain rot" da Geração Alfa.
              </p>
              <p>
                O gesto clássico? Ficar balançando as mãos para cima e para baixo, como se estivesse pesando duas opções em uma balança. Não significa nada profundo, e é justamente por isso que é tão genial!
              </p>
            </section>

            {/* Como funciona? */}
            <section className="flex flex-col max-w-lg mx-auto w-full animate-enter" style={{ animationDelay: '800ms' }}>
              <h2 className="text-2xl font-semibold tracking-tight mb-4 text-start">
                <ShinyText text="Como o jogo funciona?" speed={3} className="text-white" />
              </h2>
              <p className="text-left">
                Nós pegamos esse gesto absurdo e o transformamos em uma mecânica de jogo real!
              </p>
              
              <div className="h-12 w-full" aria-hidden="true"></div>
              
              {/* Shell Block */}
              <div className="w-full bg-[#0d0d0d] border border-neutral-800 rounded-lg overflow-hidden font-mono text-sm shadow-xl shadow-black/50">
                {/* Shell Header */}
                <div className="flex items-center px-4 py-3 bg-[#1a1a1a] border-b border-neutral-800">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                  </div>
                  <div className="flex-1 text-center text-neutral-500 text-xs font-sans tracking-wide pr-8">
                    bash — ~
                  </div>
                </div>
                {/* Shell Body */}
                <div className="p-5 flex flex-col space-y-6 text-left">
                  
                  {/* Item 1 */}
                  <div className="flex flex-col">
                    <div className="flex items-center text-emerald-400 font-semibold mb-2">
                      <span className="mr-3 opacity-50 select-none">$</span>
                      <span>./1_poder_da_camera.sh</span>
                    </div>
                    <span className="text-neutral-400 pl-4 border-l border-neutral-800 ml-[5px] leading-relaxed">
                      O jogo acessa a sua webcam e consegue entender a pose e os movimentos do seu corpo, tudo diretamente no seu navegador! Fique tranquilo, nenhuma imagem sua é gravada ou enviada para ninguém.
                    </span>
                  </div>

                  {/* Item 2 */}
                  <div className="flex flex-col">
                    <div className="flex items-center text-emerald-400 font-semibold mb-2">
                      <span className="mr-3 opacity-50 select-none">$</span>
                      <span>./2_danca_do_67.sh</span>
                    </div>
                    <span className="text-neutral-400 pl-4 border-l border-neutral-800 ml-[5px] leading-relaxed">
                      Para pontuar, você só precisa reproduzir o gesto do meme com a maior precisão possível. O nosso sistema percebe a hora exata em que você sobe e desce as mãos alternadamente pela tela!
                    </span>
                  </div>

                  {/* Item 3 */}
                  <div className="flex flex-col">
                    <div className="flex items-center text-emerald-400 font-semibold mb-2">
                      <span className="mr-3 opacity-50 select-none">$</span>
                      <span>./3_batalha_online.sh</span>
                    </div>
                    <span className="text-neutral-400 pl-4 border-l border-neutral-800 ml-[5px] leading-relaxed">
                      Você entra em uma sala virtual e compete ao vivo contra outro jogador. Quem mandar mais o gesto do "67" com velocidade e coordenação, leva a vitória!
                    </span>
                  </div>

                  {/* Item 4 */}
                  <div className="flex flex-col">
                    <div className="flex items-center text-emerald-400 font-semibold mb-2">
                      <span className="mr-3 opacity-50 select-none">$</span>
                      <span className="animate-shine bg-[length:200%_auto] bg-gradient-to-r from-red-500 via-yellow-500 via-green-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">./4_extras.sh</span>
                    </div>
                    <span className="text-neutral-400 pl-4 border-l border-neutral-800 ml-[5px] leading-relaxed">
                      Memes irão aparecer durante a partida, se você fizer o gesto do meme, ganhará pontos.
                    </span>
                  </div>

                </div>
              </div>
            </section>
          </div>

          {/* Coluna da Direita: Tecnologias */}
          <div className="flex flex-col items-center animate-enter" style={{ animationDelay: '1000ms' }}>
            <section className="flex flex-col gap-6 items-center w-full">
              <h2 className="text-2xl font-semibold text-white tracking-tight text-center relative z-20">Tecnologias Utilizadas</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">

                <SpotlightCard className="text-justify flex flex-col items-center p-6">
                  <h3 className="text-indigo-400 font-semibold mb-2 text-center w-full">Frontend</h3>
                  <p className="text-sm text-neutral-400">React, TypeScript, Vite e Tailwind CSS para uma interface rápida e responsiva.</p>
                </SpotlightCard>

                <SpotlightCard spotlightColor="rgba(16, 185, 129, 0.15)" className="text-justify flex flex-col items-center p-6">
                  <h3 className="text-emerald-400 font-semibold mb-2 text-center w-full">Visão Computacional</h3>
                  <p className="text-sm text-neutral-400">Google MediaPipe executando mapeamento corporal direto no navegador do cliente.</p>
                </SpotlightCard>

                <SpotlightCard spotlightColor="rgba(239, 68, 68, 0.15)" className="text-justify flex flex-col items-center p-6">
                  <h3 className="text-red-400 font-semibold mb-2 text-center w-full">Backend & Multiplayer</h3>
                  <p className="text-sm text-neutral-400">Servidor Python (FastAPI) lidando com conexões WebSocket em tempo real.</p>
                </SpotlightCard>

                <SpotlightCard spotlightColor="rgba(245, 158, 11, 0.15)" className="text-justify flex flex-col items-center p-6">
                  <h3 className="text-amber-400 font-semibold mb-2 text-center w-full">Infraestrutura</h3>
                  <p className="text-sm text-neutral-400">PostgreSQL para o ranking, Docker para conteinerização e Clerk para autenticação.</p>
                </SpotlightCard>

              </div>
            </section>
            
            {/* Mini Game Container no espaço vago */}
            <div className="h-12 w-full" aria-hidden="true"></div>
            <div className="w-full">
              <div className="w-full flex justify-center">
                <p className="text-neutral-400 text-sm text-center max-w-sm">
                  Alterne rápido as teclas <strong className="text-indigo-400 bg-indigo-400/10 px-2 py-1 rounded">6</strong> e <strong className="text-indigo-400 bg-indigo-400/10 px-2 py-1 rounded">7</strong> para farmar.
                </p>
              </div>
              <div className="h-8 w-full" aria-hidden="true"></div>
              <MiniGame />
            </div>
          </div>

        </div>
        {/* Espaço para outras coisas (Equipe, etc) que serão implementadas depois */}
        <div className="mt-8">
          {/* Outras coisas aqui depois */}
        </div>
      </div>
      <DuckHunt />
    </div>
  )
}