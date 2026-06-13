'use client';
import { useEffect } from 'react';

export default function ClientEnhancements() {
  useEffect(() => {
    // ---- reclaim calculator (only on the home page) ----
    const hrRange = document.getElementById('hrRange');
    const yrRange = document.getElementById('yrRange');
    const rate = document.getElementById('rate');
    const hrOut = document.getElementById('hrOut');
    const yrOut = document.getElementById('yrOut');
    const hrYear = document.getElementById('hrYear');
    const dollar = document.getElementById('dollar');
    const lifeOut = document.getElementById('lifeOut');

    function fmt(n) { return n.toLocaleString('en-US'); }
    function calc() {
      if (!hrRange || !yrRange || !rate) return;
      const hr = parseFloat(hrRange.value);
      const yr = parseInt(yrRange.value, 10);
      const rt = Math.max(0, parseFloat(rate.value) || 0);
      const perYear = Math.round(hr * 365);
      const lifeYears = (hr * 365 * yr) / (16 * 365);
      if (hrOut) hrOut.textContent = hr.toFixed(1);
      if (yrOut) yrOut.textContent = yr;
      if (hrYear) hrYear.textContent = fmt(perYear);
      if (dollar) dollar.textContent = '$' + fmt(Math.round(perYear * rt));
      if (lifeOut) lifeOut.textContent = lifeYears.toFixed(1);
    }
    [hrRange, yrRange, rate].forEach((el) => { if (el) el.addEventListener('input', calc); });
    calc();

    // ---- scroll reveal (fails safe to visible) ----
    const items = document.querySelectorAll('.reveal');
    let io;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        });
      }, { threshold: 0.12 });
      items.forEach((i) => io.observe(i));
      const t = setTimeout(() => items.forEach((i) => i.classList.add('in')), 2500);
      return () => { clearTimeout(t); if (io) io.disconnect(); [hrRange, yrRange, rate].forEach((el) => { if (el) el.removeEventListener('input', calc); }); };
    } else {
      items.forEach((i) => i.classList.add('in'));
    }
    return () => { [hrRange, yrRange, rate].forEach((el) => { if (el) el.removeEventListener('input', calc); }); };
  }, []);

  return null;
}
