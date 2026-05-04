import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LogIn, CheckCircle, Zap, Shield, BarChart3, Mail, MessageCircle } from 'lucide-react';
import LoginModal from './LoginModal';

const LandingPage: React.FC = () => {
  const [showLoginModal, setShowLoginModal] = useState(false);

  const features = [
    {
      icon: BarChart3,
      title: 'Gestão Completa',
      description: 'Controle total da escola em um só lugar',
    },
    {
      icon: Shield,
      title: 'Segurança',
      description: 'Dados protegidos e autenticação segura',
    },
    {
      icon: Zap,
      title: 'Rápido e Eficiente',
      description: 'Interface intuitiva e fácil de usar',
    },
  ];

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 overflow-hidden">
        {/* Header com Logo e Botão Login */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200/50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="flex items-center gap-2"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">D</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                SISGES SAMPAIO
              </span>
            </motion.div>

            {/* Botão Login no canto superior direito */}
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              onClick={() => setShowLoginModal(true)}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 font-semibold"
            >
              <LogIn className="w-5 h-5" />
              Login
            </motion.button>
          </div>
        </header>

        {/* Hero Section */}
        <main className="pt-32 pb-20 px-6">
          <div className="max-w-6xl mx-auto">
            {/* Texto principal */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-center mb-12"
            >
              <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Gestão Escolar Moderna
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Simplifique a administração da sua escola com nossa plataforma inteligente e intuitiva
              </p>
            </motion.div>

            {/* Card de Preço/Atração */}
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="max-w-md mx-auto mb-16"
            >
              <div className="relative group">
                {/* Efeito de brilho ao fundo */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur-2xl opacity-30 group-hover:opacity-50 transition-all duration-500"></div>

                {/* Card */}
                <div className="relative bg-white rounded-2xl p-8 shadow-xl group-hover:shadow-2xl transition-all duration-300">
                  {/* Badge "Oferta Especial" */}
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Oferta Especial
                    </span>
                  </div>

                  {/* Título do card */}
                  <h2 className="text-2xl font-bold text-green-600 mb-2 mt-4 text-center">
                    Adquira seu sistema de gestão escolar
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Solução completa para gerenciar sua instituição
                  </p>

                  {/* Preço */}
                  <div className="mb-6">
                    <div className="flex items-center justify-center gap-3 mb-2">
                      <span className="text-3xl font-bold text-gray-900">R$ 99.99</span>
                      <span className="text-sm text-gray-500">/mês</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-lg text-gray-400 line-through">R$ 500.00</span>
                      <span className="text-green-600 font-semibold text-sm">80% OFF</span>
                    </div>
                  </div>

                  {/* Feature list */}
                  <ul className="space-y-3 mb-6">
                    {['Adaptado incluse para Projeto Educampo','Gestão de alunos', 'Controle de notas', 'Agendamentos', 'Relatórios'].map(
                      (feature) => (
                        <li key={feature} className="flex items-center gap-3 text-gray-700">
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                          {feature}
                        </li>
                      )
                    )}
                  </ul>

                  {/* Texto de suporte */}
                  <p className="text-center text-xs text-gray-500">
                    Sem cartão de crédito necessário. Teste grátis por 7 dias.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Features Grid */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto"
            >
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={index}
                    whileHover={{ y: -5 }}
                    className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 text-sm">{feature.description}</p>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </main>

        {/* Seção com Imagem de Profissionais */}
        <section className="max-w-7xl mx-auto px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative rounded-2xl overflow-hidden shadow-2xl"
          >
            {/* Background Image */}
            <img
              src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=500&fit=crop"
              alt="Profissionais da educação usando tecnologia"
              className="w-full h-80 object-cover"
            />
            
            {/* Overlay escuro */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/60 to-purple-900/60"></div>

            {/* Texto sobre a imagem */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white px-6">
                <h3 className="text-4xl font-bold mb-4">
                  Transformando a Educação com Tecnologia
                </h3>
                <p className="text-lg max-w-2xl mx-auto">
                  Professores e profissionais da educação usando nossas ferramentas para criar um melhor futuro nos ambientes escolares
                </p>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="w-full bg-gradient-to-r from-blue-900 to-purple-900 text-white">
          <div className="max-w-7xl mx-auto px-6 py-12">
            {/* Contatos */}
            <div className="grid md:grid-cols-2 gap-8 mb-8 pb-8 border-b border-white/20">
              {/* Email */}
              <motion.a
                href="mailto:sisgessampaio@eadmatosinho.com"
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-4 p-4 bg-white/10 rounded-xl hover:bg-white/20 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm text-white/70">Email</p>
                  <p className="font-semibold">sisgessampaio@gerenciadorescolar.com</p>
                </div>
              </motion.a>

              {/* WhatsApp */}
              <motion.a
                href="https://wa.me/5569992004883"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-4 p-4 bg-white/10 rounded-xl hover:bg-white/20 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm text-white/70">WhatsApp</p>
                  <p className="font-semibold">(69) 99200-4883</p>
                </div>
              </motion.a>
            </div>

            {/* Copyright */}
            <div className="text-center text-white/70">
              <p>
                © {new Date().getFullYear()} SISGES SAMPAIO - Sistema de Gestão Escolar. Todos os direitos
                reservados.
              </p>
            </div>
          </div>
        </footer>
      </div>

      {/* Login Modal */}
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
    </>
  );
};

export default LandingPage;
