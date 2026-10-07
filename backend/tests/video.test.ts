import { expect, test } from 'bun:test';
import { videoLinkProblem, videoSource } from '../src/contracts/video';

test('reconoce los enlaces admitidos y los normaliza', () => {
  expect(videoSource('https://www.facebook.com/reel/28327883403549284/?mibextid=abc')).toMatchObject({
    provider: 'facebook', vertical: true, url: 'https://www.facebook.com/reel/28327883403549284/',
  });
  expect(videoSource('https://m.facebook.com/CarlosAstudillo/videos/1234567890123/')).toMatchObject({
    provider: 'facebook', vertical: false, url: 'https://www.facebook.com/CarlosAstudillo/videos/1234567890123/',
  });
  expect(videoSource('https://www.facebook.com/watch/?v=1234567890123')?.url).toBe('https://www.facebook.com/watch/?v=1234567890123');
  expect(videoSource('https://www.tiktok.com/@scout2015/video/6718335390845095173?lang=es')).toMatchObject({
    provider: 'tiktok', vertical: true, url: 'https://www.tiktok.com/@scout2015/video/6718335390845095173',
    embed: 'https://www.tiktok.com/player/v1/6718335390845095173?autoplay=1&rel=0',
  });
  expect(videoSource('https://youtu.be/aqz-KE-bpKQ?t=10')).toMatchObject({ provider: 'youtube', vertical: false, url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' });
  expect(videoSource('https://www.youtube.com/shorts/aqz-KE-bpKQ')).toMatchObject({ vertical: true, url: 'https://www.youtube.com/shorts/aqz-KE-bpKQ' });
  expect(videoSource('https://vimeo.com/123456789/abcdef1234')).toMatchObject({ provider: 'vimeo', url: 'https://vimeo.com/123456789/abcdef1234' });
  expect(videoSource('https://cdn.example.com/videos/mensaje.mp4?v=2')).toMatchObject({ provider: 'mp4', url: 'https://cdn.example.com/videos/mensaje.mp4?v=2' });
});

test('rechaza enlaces inseguros, de otros sitios o que imitan a un proveedor', () => {
  for (const value of [
    '', 'no es un enlace', 'http://www.youtube.com/watch?v=aqz-KE-bpKQ', 'javascript:alert(1)',
    'https://usuario:clave@www.youtube.com/watch?v=aqz-KE-bpKQ', 'https://www.youtube.com.evil.com/watch?v=aqz-KE-bpKQ',
    'https://evilfacebook.com/reel/28327883403549284/', 'https://www.facebook.com/CarlosAstudillo/',
    'https://vm.tiktok.com/ZMabc123/', 'https://www.facebook.com/share/v/1MyuBerxTu/', 'https://fb.watch/abc123def/', 'https://www.youtube.com/watch?v=corto', 'https://example.com/pagina',
    '<iframe src="https://www.facebook.com/plugins/video.php"></iframe>', `https://www.youtube.com/watch?v=${'a'.repeat(600)}`,
  ]) expect(videoSource(value)).toBeNull();
});

test('los enlaces cortos de compartir explican cómo obtener el enlace completo', () => {
  expect(videoLinkProblem('https://www.facebook.com/share/v/1MyuBerxTu/')).toContain('facebook.com/reel/');
  expect(videoLinkProblem('https://www.facebook.com/share/r/1MyuBerxTu/')).toContain('enlace corto');
  expect(videoLinkProblem('https://fb.watch/abc123def/')).toContain('enlace corto');
  expect(videoLinkProblem('https://vm.tiktok.com/ZMabc123/')).toContain('tiktok.com/@usuario/video/');
  expect(videoLinkProblem('https://example.com/video')).toBe('Pega el enlace de un video de Facebook, TikTok, YouTube o Vimeo.');
});

test('un MP4 no puede apuntar al equipo ni a la red local del visitante', () => {
  for (const host of [
    'localhost', 'localhost.', 'video.localhost', 'router', 'video.local', 'video.home.arpa',
    '127.0.0.1', '127.1', '2130706433', '0x7f000001', '10.0.0.1', '172.16.0.1', '192.168.1.1',
    '169.254.1.1', '[::1]', '[::ffff:127.0.0.1]', '[fe80::1]', '[fd00::1]',
  ]) expect(videoSource(`https://${host}/video.mp4`), host).toBeNull();
});
