import React from 'react';
import { LogIn, CheckCircle, BarChart3, Shield, Zap, Mail, MessageCircle, Star, Quote } from 'lucide-react';
import { motion } from 'motion/react';

interface LandingPageProps {
  onLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-purple-100 selection:text-purple-900">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 overflow-hidden">
        {/* Navigation */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200/50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-lg">D</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                SISGES SAMPAIO
              </span>
            </div>
            <button
              onClick={onLogin}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 font-semibold"
            >
              <LogIn size={20} />
              Login
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <main className="pt-32 pb-20 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent pb-2">
                Gestão Escolar Moderna
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Simplifique a administração da sua escola com nossa plataforma inteligente e intuitiva
              </p>
            </motion.div>

            {/* Pricing Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="max-w-md mx-auto mb-16 relative group cursor-default"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur-2xl opacity-30 group-hover:opacity-50 transition-all duration-500"></div>
              <div className="relative bg-white rounded-2xl p-8 shadow-xl group-hover:shadow-2xl transition-all duration-300 border border-white/40">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-md whitespace-nowrap">
                    Oferta Especial
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-green-600 mb-2 mt-4 text-center">
                  Adquira seu sistema de gestão escolar
                </h2>
                <p className="text-gray-600 mb-6 text-center">
                  Solução completa para gerenciar sua instituição
                </p>
                <div className="mb-6">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <span className="text-4xl font-bold text-gray-900">R$ 99,99</span>
                    <span className="text-sm text-gray-500 font-medium">/mês</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-lg text-gray-400 line-through font-medium">R$ 500,00</span>
                    <span className="text-green-600 font-bold text-sm bg-green-50 px-2 py-0.5 rounded">80% OFF</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-6">
                  {[
                    'Adaptado inclusive para Projeto Educampo',
                    'Gestão de alunos',
                    'Controle de notas',
                    'Agendamentos',
                    'Relatórios',
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-700 font-medium text-sm">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="text-center text-xs text-gray-500 font-medium">
                  Sem cartão de crédito necessário. Teste grátis por 7 dias.
                </p>
              </div>
            </motion.div>

            {/* Features Info */}
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-white/50"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mb-4 shadow-md text-white">
                  <BarChart3 size={24} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Gestão Completa</h3>
                <p className="text-gray-600 text-sm">Controle total da escola em um só lugar</p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-white/50"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mb-4 shadow-md text-white">
                  <Shield size={24} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Segurança</h3>
                <p className="text-gray-600 text-sm">Dados protegidos e autenticação segura</p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-white/50"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mb-4 shadow-md text-white">
                  <Zap size={24} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Rápido e Eficiente</h3>
                <p className="text-gray-600 text-sm">Interface intuitiva e fácil de usar</p>
              </motion.div>
            </div>
          </div>
        </main>

        {/* Testimonials Section */}
        <section className="py-20 bg-slate-50/50">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                O que dizem nossos clientes
              </h2>
              <p className="text-gray-600">
                Instituições que já transformaram sua gestão com o SISGES SAMPAIO.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  name: "Maria Célia Silva",
                  role: "Diretora Escolar",
                  content: "O sistema facilitou muito a nossa vida. O tempo que a secretaria gastava com papeladas agora é focado no atendimento aos alunos.",
                  school: "Escola Caminho Certo"
                },
                {
                  name: "Roberto Almeida",
                  role: "Professor",
                  content: "Prático, simples e eficiente!!!",
                  school: "Colégio Futuro"
                },
                {
                  name: "Luciana Costa",
                  role: "Coordenadora Pedagógica",
                  content: "Os professores adoraram o diário eletrônico. Muito fácil de usar, mesmo para quem não tem tanta intimidade com tecnologia.",
                  school: "Centro Educacional Saber"
                }
              ].map((testimonial, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.2 }}
                  className="bg-white rounded-2xl p-8 shadow-lg border border-purple-50 relative group hover:-translate-y-1 transition-transform duration-300"
                >
                  <Quote className="absolute top-6 right-6 w-10 h-10 text-blue-100 group-hover:text-purple-100 transition-colors" />
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-600 mb-6 italic leading-relaxed text-sm">
                    "{testimonial.content}"
                  </p>
                  <div>
                    <h4 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{testimonial.name}</h4>
                    <p className="text-sm font-medium text-purple-600">{testimonial.role}</p>
                    <p className="text-xs text-gray-400 mt-1">{testimonial.school}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Banner Section */}
        <section className="max-w-7xl mx-auto px-6 py-16">
          <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ duration: 0.8 }}
             className="relative rounded-2xl overflow-hidden shadow-2xl h-80"
          >
            <img 
              alt="Profissionais da educação usando tecnologia" 
              className="w-full h-full object-cover" 
              src="https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2070&auto=format&fit=crop" 
            />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/60 to-purple-900/60"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white px-6">
                <h3 className="text-4xl md:text-5xl font-bold mb-4">Transformando a Educação com Tecnologia</h3>
                <p className="text-lg max-w-2xl mx-auto font-medium">
                  Professores e profissionais da educação usando nossas ferramentas para criar um melhor futuro nos ambientes escolares
                </p>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="w-full bg-gradient-to-r from-blue-900 to-purple-900 text-white mt-8 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="grid md:grid-cols-2 gap-8 mb-8 pb-8 border-b border-white/20">
              <a href="mailto:sisgessampaio@gerenciadorescolar.com" className="flex items-center gap-4 p-4 bg-white/10 rounded-xl hover:bg-white/20 transition-all duration-300">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm text-white/70 font-medium">Email</p>
                  <p className="font-semibold text-lg">sisgessampaio@gerenciadorescolar.com</p>
                </div>
              </a>
              <a href="https://wa.me/5569992004883" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 bg-white/10 rounded-xl hover:bg-white/20 transition-all duration-300">
                <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm text-white/70 font-medium">WhatsApp</p>
                  <p className="font-semibold text-lg">(69) 99200-4883</p>
                </div>
              </a>
            </div>
            <div className="text-center text-white/70 text-sm font-medium">
              <p>&copy; {new Date().getFullYear()} SISGES SAMPAIO - Sistema de Gestão Escolar. Todos os direitos reservados.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

