# Katkı Animasyonu — Kurulum

Gerçek GitHub katkı verinden, her gün otomatik güncellenen animasyonlu bir SVG üretir.
Figür her sütunun dolu bloklarına alttan üste zıplar, sonraki sütunda yukarıdan aşağı
iner — S çizerek ilerler. Bastığı bloklar arkasında iz olarak kalır.

Üçüncü taraf servise bağımlılık yok; SVG'yi kendi Action'ın üretiyor.

---

## 1. Dosyaları repoya koy

`berkegemenoguz/berkegemenoguz` reposuna (profil README repon):

```
.github/workflows/contributions.yml
scripts/generate.mjs
```

```bash
git add .github/workflows/contributions.yml scripts/generate.mjs
git commit -m "katkı animasyonu ekle"
git push
```

## 2. Action'ı çalıştır

Repoda **Actions → Katkı animasyonu → Run workflow**.

İlk çalıştırmadan sonra repoda `output` diye bir dal oluşur ve içinde
`dist/contrib-light.svg` ile `dist/contrib-dark.svg` bulunur.

> **Token hatası alırsan:** Varsayılan `GITHUB_TOKEN` genelde yeterli.
> `contributionsCollection` için yetki hatası verirse
> [yeni bir classic token](https://github.com/settings/tokens/new) oluştur
> (**tek gereken yetki: `read:user`**), sonra repoda
> **Settings → Secrets and variables → Actions → New repository secret**
> altına `GH_PAT` adıyla ekle. Workflow otomatik onu kullanır.

## 3. README'ye göm

`README.md` içine şunu ekle:

```html
<picture>
  <source
    media="(prefers-color-scheme: dark)"
    srcset="https://raw.githubusercontent.com/berkegemenoguz/berkegemenoguz/output/dist/contrib-dark.svg">
  <source
    media="(prefers-color-scheme: light)"
    srcset="https://raw.githubusercontent.com/berkegemenoguz/berkegemenoguz/output/dist/contrib-light.svg">
  <img
    alt="Katkı grafiği"
    src="https://raw.githubusercontent.com/berkegemenoguz/berkegemenoguz/output/dist/contrib-light.svg">
</picture>
```

Bu kadar. Her gün 03:00 UTC'de kendini günceller.

---

## Ayarlar

`scripts/generate.mjs` içinde:

| Değişken | Ne yapar |
|---|---|
| `CELL`, `GAP` | Blok boyutu ve aralığı |
| `HEAD` | Figürün zıplaması için üstteki boşluk |
| `DUR` | Bir turun süresi — `N * 0.13` (blok başına saniye) |
| `THEMES.light/dark` | Renk paletleri. `accent` = basılan blokların rengi |
| `rise` | Zıplama yayının yüksekliği |

Gün etiketlerini değiştirmek için `dayLabels`, ay adları için `MONTHS`.

## Yerelde denemek

```bash
export GITHUB_TOKEN=ghp_xxx     # read:user yetkili token
node scripts/generate.mjs berkegemenoguz
open dist/contrib-light.svg
```

## Nasıl çalışıyor

1. GitHub **GraphQL** API'sinden `contributionsCollection.contributionCalendar`
   çekilir — katkı takvimi REST API'de yok, sadece burada var.
2. 53 hafta × 7 gün ızgara kurulur, her hücre katkı sayısına göre 5 seviyeye ayrılır.
3. S rotası hesaplanır: çift sütunlar alttan üste, tek sütunlar üstten alta,
   sadece katkı olan hücreler.
4. Rota CSS `@keyframes` olarak yazılır — her zıplama için iki kare
   (kalkışta `ease-out`, tepeden inişte `ease-in`) parabolik yay verir.
5. Basılan blokların vurgusu ayrı `opacity` animasyonlarıyla açılır; yüzdeler
   0.5'e yuvarlanarak binlerce kural yerine en fazla ~200 kural üretilir.
6. Açık ve koyu tema için iki dosya yazılır, `output` dalına force-push edilir.

`prefers-reduced-motion` açık olan kullanıcılarda animasyon durur, rota
tamamlanmış hâliyle görünür.
