/* Lot 28 « calcul » — noyau de découpe de l'herbier (creerHerbier de src/decor.js), transcription en C du noyau
   noyauJS de herbier-serre.js : mêmes opérations dans le même ordre, uniquement + − × ÷, valeur absolue et
   comparaisons (exactes en IEEE 754), donc mêmes bits qu'en JavaScript. Aucune bibliothèque C.

   /opt/homebrew/opt/llvm/bin/clang --target=wasm32 -O3 -ffp-contract=off -nostdlib -Wl,--no-entry \
     -Wl,--export=noyau -Wl,--export=__heap_base -Wl,--import-memory herbier.c -o herbier.wasm   (et -msimd128)
*/
typedef unsigned char u8;
#define EPS 1e-7

static double *A; static int haut, capA;      /* arène : sommets (x, y, z) consécutifs */
static int *L1, *L2; static int capL, nL2;     /* listes de morceaux : (début, nombre) */
static int erreur;

static inline double dist(int mode, double x, double y, double z, double a0, double a1, double a2, double a3) {
  if (mode == 0) return y - a0 - .08;
  if (mode == 1) return (a2 - a0) * (z - a1) - (a3 - a1) * (x - a0);
  return a0 + a1 * x + a2 * z - a3;
}
static inline double vabs(double x) { return __builtin_fabs(x); }

static int couper(int src, int n, int positif, int mode, double a0, double a1, double a2, double a3) {
  if (n < 3) return 0;
  if (haut + 6 * n + 6 > capA) { erreur = 1; return 0; }
  int dst = haut, m = 0;
  int la = src + 3 * (n - 1);
  double ax = A[la], ay = A[la + 1], az = A[la + 2];
  double sg = positif ? 1.0 : -1.0;
  double da = dist(mode, ax, ay, az, a0, a1, a2, a3) * sg;
  for (int q = 0; q < n; q++) {
    int lb = src + 3 * q;
    double bx = A[lb], by = A[lb + 1], bz = A[lb + 2];
    double db = dist(mode, bx, by, bz, a0, a1, a2, a3) * sg;
    int dA = da >= -EPS, dB = db >= -EPS;
    if (dA != dB) { double t = da / (da - db); int o = dst + 3 * m++; A[o] = ax + (bx - ax) * t; A[o + 1] = ay + (by - ay) * t; A[o + 2] = az + (bz - az) * t; }
    if (dB) { int o = dst + 3 * m++; A[o] = bx; A[o + 1] = by; A[o + 2] = bz; }
    ax = bx; ay = by; az = bz; da = db;
  }
  haut = dst + 3 * m;
  return m;
}
static double aire2(int src, int n) {
  double s = 0;
  for (int q = 0; q < n; q++) { int a = src + 3 * q, b = src + 3 * ((q + 1) % n); s = s + A[a] * A[b + 2] - A[b] * A[a + 2]; }
  return s;
}
static double aire2M(const double *M, int o, int n) {
  double s = 0;
  for (int q = 0; q < n; q++) { int a = 2 * (o + q), b = 2 * (o + (q + 1) % n); s = s + M[a] * M[b + 1] - M[b] * M[a + 1]; }
  return s;
}
static void pousser(int debut, int n) {
  if (2 * nL2 + 2 > capL) { erreur = 2; return; }
  L2[2 * nL2] = debut; L2[2 * nL2 + 1] = n; nL2++;
}
static void retirer(int src, int n, const double *MM, int mo, int mn) {
  int inter = src, ni = n;
  for (int i = 0; i < mn && ni >= 3; i++) {
    int a = 2 * (mo + i), b = 2 * (mo + (i + 1) % mn);
    int nouveau = couper(inter, ni, 1, 1, MM[a], MM[a + 1], MM[b], MM[b + 1]); inter = haut - 3 * nouveau; ni = nouveau;
  }
  if (ni < 3 || vabs(aire2(inter, ni)) < .002) { pousser(src, n); return; }
  if (vabs(aire2(inter, ni)) >= vabs(aire2(src, n)) - .002) return;
  int dedans = src, nd = n;
  for (int i = 0; i < mn && nd >= 3; i++) {
    int a = 2 * (mo + i), b = 2 * (mo + (i + 1) % mn);
    int nm = couper(dedans, nd, 0, 1, MM[a], MM[a + 1], MM[b], MM[b + 1]), debutM = haut - 3 * nm;
    if (nm >= 3 && vabs(aire2(debutM, nm)) > .002) pousser(debutM, nm);
    int nn = couper(dedans, nd, 1, 1, MM[a], MM[a + 1], MM[b], MM[b + 1]); dedans = haut - 3 * nn; nd = nn;
  }
}

/* Rend le nombre de doubles écrits dans OUT (11 par triangle : source, 9 coordonnées, aire), ou −code d'erreur. */
int noyau(const double *P, const double *PL, const double *LEN, const u8 *VEG, const int *brutes, int nb,
          const double *M, const int *MOff, const int *CM, const int *CMO, const int *CC, const int *CCO,
          double eau, int aEau, double *arene, int capArene, int *listes, int capListes, double *OUT, int capOut) {
  A = arene; capA = capArene; L1 = listes; L2 = listes + capListes; capL = capListes; erreur = 0;
  double MASQUE[128];
  int no = 0;
  for (int q = 0; q < nb; q++) {
    int s = brutes[q]; haut = 0;
    for (int u = 0; u < 9; u++) A[u] = P[9 * s + u];
    haut = 9;
    int nL1 = 0;
    if (aEau) { int m = couper(0, 3, 1, 0, eau, 0, 0, 0); if (m >= 3) { L1[0] = haut - 3 * m; L1[1] = m; nL1 = 1; } }
    else { L1[0] = 0; L1[1] = 3; nL1 = 1; }
    for (int u = CMO[q]; u < CMO[q + 1] && nL1; u++) {
      int k = CM[u], mo = MOff[k], mn = MOff[k + 1] - mo;
      nL2 = 0; for (int v = 0; v < nL1; v++) retirer(L1[2 * v], L1[2 * v + 1], M, mo, mn);
      int *t = L1; L1 = L2; L2 = t; nL1 = nL2;
    }
    double sdx = PL[3 * s], sdz = PL[3 * s + 1], sh = PL[3 * s + 2];
    for (int u = CCO[q]; u < CCO[q + 1] && nL1; u++) {
      int k = CC[u];
      double dh = PL[3 * k + 2] - sh, dx = PL[3 * k] - sdx, dz = PL[3 * k + 1] - sdz;
      if (VEG[k] && vabs(dx) + vabs(dz) < 1e-8 && vabs(dh) < .0005 && k > s) continue;
      if (haut + 9 > capA) { erreur = 1; break; }
      int src = haut; for (int w = 0; w < 9; w++) A[src + w] = P[9 * k + w]; haut += 9;
      int mm = couper(src, 3, 1, 2, dh, dx, dz, VEG[k] ? .0005 : -.0005), debut = haut - 3 * mm;
      if (mm < 3) continue;
      if (mm > 64) { erreur = 3; break; }
      for (int w = 0; w < mm; w++) { MASQUE[2 * w] = A[debut + 3 * w]; MASQUE[2 * w + 1] = A[debut + 3 * w + 2]; }
      if (!(vabs(aire2M(MASQUE, 0, mm)) > .002)) continue;
      nL2 = 0; for (int v = 0; v < nL1; v++) retirer(L1[2 * v], L1[2 * v + 1], MASQUE, 0, mm);
      int *t = L1; L1 = L2; L2 = t; nL1 = nL2;
    }
    double len = LEN[s];
    for (int v = 0; v < nL1; v++) {
      int p = L1[2 * v], n = L1[2 * v + 1];
      for (int k = 1; k < n - 1; k++) {
        int a = p, b = p + 3 * k, d = p + 3 * (k + 1);
        double s2 = 0; s2 = s2 + A[a] * A[b + 2] - A[b] * A[a + 2]; s2 = s2 + A[b] * A[d + 2] - A[d] * A[b + 2]; s2 = s2 + A[d] * A[a + 2] - A[a] * A[d + 2];
        double aire = vabs(s2) / 2 * len;
        if (aire < .02) continue;
        if (no + 11 > capOut) return -4;
        OUT[no++] = s;
        OUT[no++] = A[a]; OUT[no++] = A[a + 1]; OUT[no++] = A[a + 2];
        OUT[no++] = A[b]; OUT[no++] = A[b + 1]; OUT[no++] = A[b + 2];
        OUT[no++] = A[d]; OUT[no++] = A[d + 1]; OUT[no++] = A[d + 2];
        OUT[no++] = aire;
      }
    }
    if (erreur) return -erreur;
  }
  return no;
}
