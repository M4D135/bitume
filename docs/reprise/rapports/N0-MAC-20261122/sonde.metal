#include <metal_stdlib>
using namespace metal;
struct Sortie { float4 position [[position]]; float4 couleur; };
vertex Sortie sommet(uint indice [[vertex_id]], uint instance [[instance_id]], constant float2* sommets [[buffer(0)]]) {
    const float x = instance == 0 ? -0.5f : 0.5f;
    return { float4(sommets[indice] + float2(x, 0), 0.3f, 1),
             instance == 0 ? float4(1,0,0,0.5) : float4(0,0,1,0.5) };
}
fragment float4 couleur(Sortie p [[stage_in]]) { return p.couleur; }
