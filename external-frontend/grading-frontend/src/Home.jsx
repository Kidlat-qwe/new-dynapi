import React from 'react';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import carousel2 from './assets/carousel2.jpg';
import carousel3 from './assets/carousel3.jpg';
import carousel4 from './assets/carousel4.jpg';

const Home = () => {
  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 2000,
    arrows: false,
  };

  return (
    <div className="content-container bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 p-6 flex flex-col items-center pt-8 flex-grow relative overflow-hidden">
      {/* Flying Bees Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Bee 1 - Top left area */}
        <div className="absolute top-10 left-4 text-3xl animate-flyAround1">🐝</div>
        
        {/* Bee 2 - Top right area */}
        <div className="absolute top-20 right-8 text-2xl animate-flyAround2">🐝</div>
        
        {/* Bee 3 - Middle left */}
        <div className="absolute top-1/3 left-2 text-4xl animate-flyAround3">🐝</div>
        
        {/* Bee 4 - Middle right */}
        <div className="absolute top-1/2 right-4 text-2xl animate-flyAround4">🐝</div>
        
        {/* Bee 5 - Bottom left */}
        <div className="absolute bottom-20 left-6 text-3xl animate-flyAround5">🐝</div>
        
        {/* Bee 6 - Bottom right */}
        <div className="absolute bottom-32 right-12 text-2xl animate-flyAround6">🐝</div>
        
        {/* Bee 7 - Center area */}
        <div className="absolute top-2/3 left-1/4 text-3xl animate-flyAround7">🐝</div>
        
        {/* Bee 8 - Far right */}
        <div className="absolute top-1/4 right-2 text-2xl animate-flyAround8">🐝</div>
        
        {/* Bee 9 - Far left */}
        <div className="absolute bottom-1/3 left-1 text-4xl animate-flyAround9">🐝</div>
        
        {/* Bee 10 - Top center */}
        <div className="absolute top-16 left-1/2 text-2xl animate-flyAround10">🐝</div>
      </div>

      {/* Floating decorative flowers inspired by logo colors */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Sunflowers */}
        <div className="absolute top-20 left-16 text-3xl animate-float1">🌻</div>
        <div className="absolute bottom-32 right-20 text-4xl animate-float2">🌻</div>
        <div className="absolute top-1/2 left-8 text-2xl animate-float3">🌻</div>
        
        {/* Other beautiful flowers */}
        <div className="absolute top-40 right-16 text-3xl animate-float4">🌺</div>
        <div className="absolute bottom-20 left-1/3 text-2xl animate-float5">🌷</div>
        <div className="absolute top-32 right-1/3 text-3xl animate-float6">🌹</div>
        <div className="absolute bottom-40 left-1/4 text-2xl animate-float7">🌸</div>
        
        {/* More variety */}
        <div className="absolute top-16 right-1/4 text-2xl animate-float1">🌼</div>
        <div className="absolute bottom-16 left-1/2 text-3xl animate-float3">🌿</div>
        <div className="absolute top-1/3 right-8 text-2xl animate-float5">🌾</div>
        <div className="absolute bottom-1/3 left-16 text-3xl animate-float2">🌱</div>
      </div>

      {/* Main carousel container */}
      <div className="w-full max-w-xl relative z-10">
        <div className="absolute inset-0 z-0 rounded-2xl bg-gradient-to-br from-yellow-200 via-amber-100 to-orange-200 shadow-2xl flex items-center justify-center overflow-hidden">
          {/* Enhanced playful shapes with logo-inspired colors */}
          <div className="absolute top-4 left-8 w-16 h-16 bg-yellow-300 rounded-full opacity-60 animate-bounce-slow" />
          <div className="absolute bottom-8 right-8 w-20 h-20 bg-amber-300 rounded-full opacity-50 animate-bounce-slower" />
          <div className="absolute top-1/2 left-1/2 w-10 h-10 bg-yellow-400 rounded-full opacity-40 animate-spin-slow" />
          <div className="absolute bottom-4 left-1/3 w-8 h-8 bg-orange-200 rounded-full opacity-60 animate-bounce" />
          <div className="absolute top-10 right-1/4 w-12 h-12 bg-yellow-200 rounded-full opacity-50 animate-bounce" />
          
          {/* Additional decorative elements */}
          <div className="absolute top-1/4 right-8 w-6 h-6 bg-amber-400 rounded-full opacity-70 animate-pulse" />
          <div className="absolute bottom-1/4 left-12 w-14 h-14 bg-yellow-500 rounded-full opacity-30 animate-ping" />
        </div>
        
        <div className="relative z-10 p-4">
          <Slider {...settings}>
            <div>
              <img src={carousel2} alt="Slide 1" className="rounded-lg w-full object-contain max-h-96" />
            </div>
            <div>
              <img src={carousel3} alt="Slide 2" className="rounded-lg w-full object-contain max-h-96" />
            </div>
            <div>
              <img src={carousel4} alt="Slide 3" className="rounded-lg w-full object-contain max-h-96" />
            </div>
          </Slider>
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes flyAround1 {
          0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
          25% { transform: translate(150px, -50px) rotate(90deg) scale(1.1); }
          50% { transform: translate(300px, 30px) rotate(180deg) scale(0.9); }
          75% { transform: translate(100px, 80px) rotate(270deg) scale(1.2); }
        }
        
        @keyframes flyAround2 {
          0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
          33% { transform: translate(-200px, 60px) rotate(120deg) scale(1.1); }
          66% { transform: translate(-400px, -30px) rotate(240deg) scale(0.8); }
        }
        
        @keyframes flyAround3 {
          0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
          20% { transform: translate(120px, -60px) rotate(72deg) scale(1.3); }
          40% { transform: translate(250px, 40px) rotate(144deg) scale(0.9); }
          60% { transform: translate(400px, -40px) rotate(216deg) scale(1.1); }
          80% { transform: translate(180px, 70px) rotate(288deg) scale(0.8); }
        }
        
        @keyframes flyAround4 {
          0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
          25% { transform: translate(-100px, -30px) rotate(90deg) scale(1.2); }
          50% { transform: translate(-250px, 50px) rotate(180deg) scale(0.9); }
          75% { transform: translate(-150px, 100px) rotate(270deg) scale(1.1); }
        }
        
        @keyframes flyAround5 {
          0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
          30% { transform: translate(80px, -40px) rotate(108deg) scale(1.1); }
          60% { transform: translate(200px, 20px) rotate(216deg) scale(0.8); }
          90% { transform: translate(50px, 60px) rotate(324deg) scale(1.3); }
        }
        
        @keyframes flyAround6 {
          0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
          40% { transform: translate(-120px, -20px) rotate(144deg) scale(1.2); }
          80% { transform: translate(-300px, 40px) rotate(288deg) scale(0.9); }
        }
        
        @keyframes flyAround7 {
          0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
          25% { transform: translate(100px, -30px) rotate(90deg) scale(1.1); }
          50% { transform: translate(200px, 40px) rotate(180deg) scale(0.8); }
          75% { transform: translate(50px, 80px) rotate(270deg) scale(1.2); }
        }
        
        @keyframes flyAround8 {
          0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
          35% { transform: translate(-80px, 30px) rotate(126deg) scale(1.3); }
          70% { transform: translate(-180px, -20px) rotate(252deg) scale(0.9); }
        }
        
        @keyframes flyAround9 {
          0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
          20% { transform: translate(60px, -50px) rotate(72deg) scale(1.1); }
          40% { transform: translate(150px, 30px) rotate(144deg) scale(0.8); }
          60% { transform: translate(250px, -30px) rotate(216deg) scale(1.2); }
          80% { transform: translate(100px, 50px) rotate(288deg) scale(0.9); }
        }
        
        @keyframes flyAround10 {
          0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
          30% { transform: translate(-50px, 40px) rotate(108deg) scale(1.2); }
          60% { transform: translate(-100px, -20px) rotate(216deg) scale(0.8); }
          90% { transform: translate(-30px, 60px) rotate(324deg) scale(1.1); }
        }
        
        @keyframes float1 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
        
        @keyframes float2 {
          0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
          50% { transform: translateY(-30px) rotate(180deg) scale(1.1); }
        }
        
        @keyframes float3 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(-180deg); }
        }
        
        @keyframes float4 {
          0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
          50% { transform: translateY(-25px) rotate(180deg) scale(1.2); }
        }
        
        @keyframes float5 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-18px) rotate(-90deg); }
        }
        
        @keyframes float6 {
          0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
          50% { transform: translateY(-22px) rotate(180deg) scale(1.1); }
        }
        
        @keyframes float7 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(-180deg); }
        }
        
        .animate-flyAround1 { animation: flyAround1 12s ease-in-out infinite; }
        .animate-flyAround2 { animation: flyAround2 15s ease-in-out infinite; }
        .animate-flyAround3 { animation: flyAround3 18s ease-in-out infinite; }
        .animate-flyAround4 { animation: flyAround4 14s ease-in-out infinite; }
        .animate-flyAround5 { animation: flyAround5 16s ease-in-out infinite; }
        .animate-flyAround6 { animation: flyAround6 13s ease-in-out infinite; }
        .animate-flyAround7 { animation: flyAround7 17s ease-in-out infinite; }
        .animate-flyAround8 { animation: flyAround8 11s ease-in-out infinite; }
        .animate-flyAround9 { animation: flyAround9 19s ease-in-out infinite; }
        .animate-flyAround10 { animation: flyAround10 14s ease-in-out infinite; }
        
        .animate-float1 { animation: float1 3s ease-in-out infinite; }
        .animate-float2 { animation: float2 4s ease-in-out infinite; }
        .animate-float3 { animation: float3 2.5s ease-in-out infinite; }
        .animate-float4 { animation: float4 3.5s ease-in-out infinite; }
        .animate-float5 { animation: float5 2.8s ease-in-out infinite; }
        .animate-float6 { animation: float6 3.2s ease-in-out infinite; }
        .animate-float7 { animation: float7 2.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default Home;
