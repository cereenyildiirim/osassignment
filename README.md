# CPU Scheduling Simulator

CSE513 ödevi için adım adım geliştirilen CPU zamanlama simülatörü.
Bu aşamada hesaplama motoru ve otomatik testler hazırdır; web arayüzü henüz eklenmedi.

## Dosyalar

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
Bu uygulama Ubuntu'nun gerçek zamanlayıcısını taklit etmez.
