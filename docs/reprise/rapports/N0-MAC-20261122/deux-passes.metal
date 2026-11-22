#include <metal_stdlib>
using namespace metal;
struct Sortie { float4 position [[position]]; float4 couleur; };
vertex Sortie sommet(uint indice [[vertex_id]], uint instance [[instance_id]], constant float2* sommets [[buffer(0)]]) {
    float x = instance == 0 ? -.5f : .5f;
    return {float4(sommets[indice]+float2(x,0),.3f,1), instance == 0 ? float4(1,0,0,.5) : float4(0,0,1,.5)};
}
fragment float4 scene(Sortie p [[stage_in]]) { return p.couleur; }
vertex float4 ecran(uint id [[vertex_id]]) {
    constexpr float2 tri[]={float2(-1,-1),float2(3,-1),float2(-1,3)};return float4(tri[id],0,1);
}
fragment float4 miroir(float4 p [[position]], texture2d<float> image [[texture(0)]], sampler filtre [[sampler(0)]]) {
    return image.sample(filtre,float2(1.f-p.x/32.f,p.y/16.f));
}
