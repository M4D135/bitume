#include <SDL3/SDL_gpu.h>
#include <SDL3/SDL_version.h>
#include <SDL3/SDL_init.h>
#include <array>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <iterator>
#include <vector>
void verifier(bool ok) {if(!ok) {std::fprintf(stderr,"%s\n",SDL_GetError());std::exit(1);}}
int main() {
    verifier(SDL_Init(SDL_INIT_VIDEO));
    auto d=SDL_CreateGPUDevice(SDL_GPU_SHADERFORMAT_METALLIB,true,"metal"); verifier(d);
    std::ifstream fichier("deux-passes.metallib",std::ios::binary);
    std::vector<Uint8> octets{std::istreambuf_iterator<char>(fichier),{}}; verifier(!octets.empty());
    auto shader=[&](const char* nom,SDL_GPUShaderStage stade,unsigned textures,unsigned uniformes){
        SDL_GPUShaderCreateInfo info{}; info.code=octets.data();info.code_size=octets.size();info.entrypoint=nom;
        info.format=SDL_GPU_SHADERFORMAT_METALLIB;info.stage=stade; info.num_samplers=textures;info.num_uniform_buffers=uniformes;
        auto s=SDL_CreateGPUShader(d,&info);verifier(s);return s;
    };
    SDL_GPUTextureCreateInfo ti{};ti.type=SDL_GPU_TEXTURETYPE_2D;ti.format=SDL_GPU_TEXTUREFORMAT_R8G8B8A8_UNORM;
    ti.usage=SDL_GPU_TEXTUREUSAGE_COLOR_TARGET|SDL_GPU_TEXTUREUSAGE_SAMPLER;ti.width=32;ti.height=16;
    ti.layer_count_or_depth=1;ti.num_levels=1; auto image=SDL_CreateGPUTexture(d,&ti);auto reflet=SDL_CreateGPUTexture(d,&ti);verifier(image&&reflet);
    ti.format=SDL_GPU_TEXTUREFORMAT_D32_FLOAT;ti.usage=SDL_GPU_TEXTUREUSAGE_DEPTH_STENCIL_TARGET;
    auto profondeur=SDL_CreateGPUTexture(d,&ti);verifier(profondeur);
    SDL_GPUColorTargetDescription sortie{};sortie.format=SDL_GPU_TEXTUREFORMAT_R8G8B8A8_UNORM;
    auto &melange=sortie.blend_state;melange.enable_blend=true;melange.src_color_blendfactor=SDL_GPU_BLENDFACTOR_SRC_ALPHA;
    melange.dst_color_blendfactor=SDL_GPU_BLENDFACTOR_ONE_MINUS_SRC_ALPHA;melange.color_blend_op=SDL_GPU_BLENDOP_ADD;
    melange.src_alpha_blendfactor=SDL_GPU_BLENDFACTOR_ONE;melange.dst_alpha_blendfactor=SDL_GPU_BLENDFACTOR_ZERO;melange.alpha_blend_op=SDL_GPU_BLENDOP_ADD;
    auto v=shader("sommet",SDL_GPU_SHADERSTAGE_VERTEX,0,1), f=shader("scene",SDL_GPU_SHADERSTAGE_FRAGMENT,0,0);
    SDL_GPUGraphicsPipelineCreateInfo p{};p.vertex_shader=v;p.fragment_shader=f;p.primitive_type=SDL_GPU_PRIMITIVETYPE_TRIANGLELIST;
    p.target_info.num_color_targets=1;p.target_info.color_target_descriptions=&sortie;p.target_info.has_depth_stencil_target=true;
    p.target_info.depth_stencil_format=SDL_GPU_TEXTUREFORMAT_D32_FLOAT;p.depth_stencil_state.enable_depth_test=true;p.depth_stencil_state.enable_depth_write=true;
    p.depth_stencil_state.compare_op=SDL_GPU_COMPAREOP_LESS;
    auto scene=SDL_CreateGPUGraphicsPipeline(d,&p);verifier(scene);
    auto v2=shader("ecran",SDL_GPU_SHADERSTAGE_VERTEX,0,0), f2=shader("miroir",SDL_GPU_SHADERSTAGE_FRAGMENT,1,0);
    p.vertex_shader=v2;p.fragment_shader=f2;p.target_info.has_depth_stencil_target=false;p.depth_stencil_state={};melange.enable_blend=false;
    auto miroir=SDL_CreateGPUGraphicsPipeline(d,&p);verifier(miroir);
    SDL_GPUSamplerCreateInfo si{};auto filtre=SDL_CreateGPUSampler(d,&si);verifier(filtre);
    SDL_GPUTransferBufferCreateInfo li{};li.size=4096;li.usage=SDL_GPU_TRANSFERBUFFERUSAGE_DOWNLOAD;
    auto lecture=SDL_CreateGPUTransferBuffer(d,&li);verifier(lecture);
    auto cmd=SDL_AcquireGPUCommandBuffer(d);verifier(cmd);
    SDL_GPUColorTargetInfo ci{};ci.texture=image;ci.load_op=SDL_GPU_LOADOP_CLEAR;ci.store_op=SDL_GPU_STOREOP_STORE;ci.clear_color={0,1,0,1};
    SDL_GPUDepthStencilTargetInfo zi{};zi.texture=profondeur;zi.clear_depth=1;zi.load_op=SDL_GPU_LOADOP_CLEAR;zi.store_op=SDL_GPU_STOREOP_DONT_CARE;
    auto passe=SDL_BeginGPURenderPass(cmd,&ci,1,&zi);verifier(passe);SDL_BindGPUGraphicsPipeline(passe,scene);
    const std::array<float,8> sommets={-.46f,-.8f,.46f,-.8f,0.f,.85f,0,0};
    SDL_PushGPUVertexUniformData(cmd,0,sommets.data(),sizeof(sommets));SDL_DrawGPUPrimitives(passe,3,2,0,0);SDL_EndGPURenderPass(passe);
    ci.texture=reflet;ci.clear_color={1,0,1,1};passe=SDL_BeginGPURenderPass(cmd,&ci,1,nullptr);verifier(passe);
    SDL_BindGPUGraphicsPipeline(passe,miroir);SDL_GPUTextureSamplerBinding entree{image,filtre};SDL_BindGPUFragmentSamplers(passe,0,&entree,1);
    SDL_DrawGPUPrimitives(passe,3,1,0,0);SDL_EndGPURenderPass(passe);
    SDL_GPUTextureRegion region{};region.texture=reflet;region.w=32;region.h=16;region.d=1;
    SDL_GPUTextureTransferInfo destination{lecture,0,64,16};auto copie=SDL_BeginGPUCopyPass(cmd);
    SDL_DownloadFromGPUTexture(copie,&region,&destination);SDL_EndGPUCopyPass(copie);
    auto barriere=SDL_SubmitGPUCommandBufferAndAcquireFence(cmd);verifier(barriere);verifier(SDL_WaitForGPUFences(d,true,&barriere,1));
    auto pixels=static_cast<Uint8*>(SDL_MapGPUTransferBuffer(d,lecture,false));verifier(pixels);pixels+=8*256;
    printf("SDL %d, backend %s, shaders metallib, 2 instances transparentes et profondeur, texture miroir relue\n", SDL_GetVersion(),SDL_GetGPUDeviceDriver(d));
    for (int x : {0,8,24}) printf("x=%d RGB %u %u %u\n",x,pixels[4*x],pixels[4*x+1],pixels[4*x+2]);
    bool correct=pixels[1]==255 && pixels[32]==0 && pixels[33]>=127 && pixels[34]>=127 && pixels[96]>=127 && pixels[97]>=127 && pixels[98]==0;
    SDL_UnmapGPUTransferBuffer(d,lecture);SDL_ReleaseGPUFence(d,barriere);SDL_ReleaseGPUTransferBuffer(d,lecture);
    SDL_ReleaseGPUGraphicsPipeline(d,scene);SDL_ReleaseGPUGraphicsPipeline(d,miroir);for (auto s:{v,f,v2,f2}) SDL_ReleaseGPUShader(d,s);
    SDL_ReleaseGPUSampler(d,filtre);for(auto t:{image,reflet,profondeur}) SDL_ReleaseGPUTexture(d,t);
    SDL_DestroyGPUDevice(d);SDL_Quit();return correct?0:2;
}
