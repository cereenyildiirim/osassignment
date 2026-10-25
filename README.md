# CPU Scheduling Simulator

CSE513 ödevi için adım adım geliştirilen CPU zamanlama simülatörü.
Tarayıcıda çalışan, sunucu tarafı uygulama veya veritabanı gerektirmeyen bir CPU zamanlama simülatörü.

## Web arayüzünü çalıştırma

Depo dizininde Python 3 ile statik dosya sunucusunu başlatın:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Tarayıcıda `http://127.0.0.1:8000` adresini açın. Durdurmak için terminalde Ctrl+C kullanın.
ES modülleri kullanıldığı için `index.html` dosyasını doğrudan çift tıklamak yerine HTTP üzerinden açın.
Python yalnızca yerel geliştirme için dosya sunar; uygulamanın backend'i değildir.
Modern bir tarayıcı yeterlidir; uygulama için npm kurulumu gerekmez.

### Kullanım

1. Workload A veya Workload B yükleyin; isterseniz işlem ekleyin, düzenleyin veya silin.
2. FCFS, SJF, SRTF veya Round Robin seçin. Round Robin için quantum değerini girin.
3. Simülasyonu çalıştırın. Girdi değişiklikleri eski sonuçları gizler; yeniden çalıştırmanız gerekir.
4. Gantt grafiğini, işlem tablosunu ve ortalamaları inceleyin. Dar ekranlarda grafik ve tablo yatay kaydırılır.

Başlangıçta A verisinin SRTF sonucu gösterilir. Örnek yükleme düğmeleri seçili algoritmayla yeniden hesaplar.
Boş CPU aralıkları Idle olarak işaretlenir. RR quantum sınırları aynı işlem devam etse bile ayrı gösterilir.
Grafikte kısa dilimler okunabilirlik için minimum genişliğe sahiptir; kesin süreler blok sınırlarında,
blok açıklamalarında ve “Çalışma aralıklarını incele” bölümünde belirtilir.

## Dosyalar

- `index.html`: İşlem girişleri, algoritma seçimi ve sonuç ekranının yapısı.
- `styles.css`: Masaüstü ve mobil görünüm.
- `app.mjs`: Girdileri okur, hesaplama motorunu çağırır ve sonuçları ekrana yerleştirir.
- `scheduler.mjs`: FCFS, kesintisiz SJF, SRTF ve Round Robin; giriş doğrulama ve ölçümler.
- `workloads.mjs`: Ödevdeki A ve B işlem listeleri.
- `scheduler.test.mjs`: Elle hesaplanan sekiz örnek, ek iş yükleri ve özel kural testleri.

## Yerel çalıştırma

Node.js 22 veya üzeri önerilir. Harici paket ve paket kurulumu gerekmez.
Depo dizininde testleri çalıştırın:

```sh
node --test scheduler.test.mjs
```

A iş yükünün SRTF sonucunu görmek için:

```sh
node --input-type=module -e "import {simulate} from './scheduler.mjs'; import {WORKLOAD_A} from './workloads.mjs'; const r=simulate(WORKLOAD_A,'SRTF'); console.table(r.timeline); console.table(r.results); console.log(r.averages);"
```

## Veri modeli

Giriş işlemi: `{ id: 'P1', arrival: 0, burst: 8 }`.
`simulate(processes, algorithm, quantum = 2)` giriş verisini değiştirmez.
Algoritma: `FCFS`, `SJF`, `SRTF` veya `RR`.

Sonuçtaki `timeline`, `{id, start, end}` aralıklarından oluşur.
`id: null` CPU'nun boş olduğunu belirtir. Aralıklar `[start, end)` biçimindedir.
`results` işlem başına ölçümleri, `averages` üç ortalamayı içerir.
Round Robin'de art arda aynı işlem çalışsa bile quantum dilimleri birleştirilmez.

## Sınırlar

Tek CPU, işlem başına tek CPU burst, I/O yok, geçiş maliyeti sıfırdır.
Geliş zamanı negatif olmayan; CPU süresi ve quantum pozitif tam sayı olmalıdır.
Sayısal doğruluk için JavaScript güvenli tam sayı aralığı kontrol edilir.
Çok küçük quantum ve çok büyük CPU süreleri çok sayıda çizelge dilimi oluşturabilir.
Arayüz, tarayıcıyı korumak için 5.000'den fazla RR dilimi oluşturacak girişleri açıklayıcı mesajla reddeder.
Grafikte altı renk dönüşümlü kullanılır; işlem ID'leri renklerden bağımsız olarak gösterilir.
Bu uygulama Ubuntu'nun gerçek zamanlayıcısını taklit etmez.

## Doğrulanan arayüz davranışları

Geliştirme ortamında Chromium ve Playwright ile A/B'nin sekiz algoritma örneği çalıştırıldı.
Ekrandaki tüm işlem ölçümleri ve çalışma aralıkları motor çıktısıyla; üç ortalama ayrıca elle bulunan
değerlerle karşılaştırıldı. Boş CPU aralıkları, işlem ekleme/silme/düzenleme, geçersiz geliş/quantum,
yinelenen ID, kullanıcı metninin HTML olarak yorumlanmaması ve 320/390 piksel görünüm kontrolleri geçti.
Bu tarayıcı kontrolleri geliştirme ortamında çalıştırıldı; yukarıdaki Node.js test komutu hesaplama
motorunun 16 testini çalıştırır. Site henüz herkese açık bir adrese yayınlanmadı.
