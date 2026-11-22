#import <Foundation/Foundation.h>
#import <Metal/Metal.h>
#include <array>
#include <cstdio>
#include <span>
int main(int argc, const char** argv) {
  @autoreleasepool {
    if (argc != 2) return 1;
    auto gpu = MTLCreateSystemDefaultDevice();
    if (!gpu) return 2;
    NSError *erreur = nil;
    auto lib = [gpu newLibraryWithURL:[NSURL fileURLWithPath:[NSString stringWithUTF8String:argv[1]]] error:&erreur];
    if (!lib) { NSLog(@"%@", erreur); return 3; }
    auto cible = [MTLTextureDescriptor texture2DDescriptorWithPixelFormat:MTLPixelFormatRGBA8Unorm width:32 height:16 mipmapped:NO];
    cible.usage = MTLTextureUsageRenderTarget | MTLTextureUsageShaderRead;
    auto image = [gpu newTextureWithDescriptor:cible];
    auto profondeur = [MTLTextureDescriptor texture2DDescriptorWithPixelFormat:MTLPixelFormatDepth32Float width:32 height:16 mipmapped:NO];
    profondeur.usage = MTLTextureUsageRenderTarget; profondeur.storageMode = MTLStorageModePrivate;
    auto z = [gpu newTextureWithDescriptor:profondeur];
    auto pipeline = [MTLRenderPipelineDescriptor new];
    pipeline.vertexFunction = [lib newFunctionWithName:@"sommet"]; pipeline.fragmentFunction = [lib newFunctionWithName:@"couleur"];
    auto a = pipeline.colorAttachments[0]; a.pixelFormat = MTLPixelFormatRGBA8Unorm;
    a.blendingEnabled = YES; a.sourceRGBBlendFactor = MTLBlendFactorSourceAlpha;
    a.destinationRGBBlendFactor = MTLBlendFactorOneMinusSourceAlpha;
    pipeline.depthAttachmentPixelFormat = MTLPixelFormatDepth32Float;
    auto programme = [gpu newRenderPipelineStateWithDescriptor:pipeline error:&erreur];
    if (!programme) { NSLog(@"%@", erreur); return 4; }
    auto depth = [MTLDepthStencilDescriptor new]; depth.depthCompareFunction = MTLCompareFunctionLess; depth.depthWriteEnabled = YES;
    const std::array<float,6> triangles = {-.46f,-.8f,.46f,-.8f,0.f,.85f};
    std::span<const float> sommets(triangles);
    auto sommet = [gpu newBufferWithBytes:sommets.data() length:sommets.size_bytes() options:MTLResourceStorageModeShared];
    auto pixels = [gpu newBufferWithLength:256*16 options:MTLResourceStorageModeShared];
    auto file = [gpu newCommandQueue]; auto lot = [file commandBuffer];
    auto passe = [MTLRenderPassDescriptor renderPassDescriptor];
    auto couleur = passe.colorAttachments[0]; couleur.texture = image; couleur.loadAction = MTLLoadActionClear;
    couleur.clearColor = MTLClearColorMake(0,1,0,1); couleur.storeAction=MTLStoreActionStore;
    passe.depthAttachment.texture=z; passe.depthAttachment.loadAction=MTLLoadActionClear; passe.depthAttachment.clearDepth=1;
    auto enc = [lot renderCommandEncoderWithDescriptor:passe]; [enc setRenderPipelineState:programme];
    [enc setDepthStencilState:[gpu newDepthStencilStateWithDescriptor:depth]]; [enc setVertexBuffer:sommet offset:0 atIndex:0];
    [enc drawPrimitives:MTLPrimitiveTypeTriangle vertexStart:0 vertexCount:3 instanceCount:2]; [enc endEncoding];
    auto copie = [lot blitCommandEncoder];
    [copie copyFromTexture:image sourceSlice:0 sourceLevel:0 sourceOrigin:MTLOriginMake(0,0,0) sourceSize:MTLSizeMake(32,16,1)
      toBuffer:pixels destinationOffset:0 destinationBytesPerRow:256 destinationBytesPerImage:4096];
    [copie endEncoding]; [lot commit]; [lot waitUntilCompleted];
    if (lot.status != MTLCommandBufferStatusCompleted) { NSLog(@"%@", lot.error); return 5; }
    auto p = (const unsigned char*)pixels.contents + 8*256;
    printf("GPU %s, natif arm64, C++20, cible RGBA8 + profondeur Depth32Float 32x16\n",gpu.name.UTF8String);
    for (int x : {0,8,24}) printf("x=%d RGB %u %u %u\n",x,p[4*x],p[4*x+1],p[4*x+2]);
    return p[1]==255 && p[32]>=127 && p[32]<=129 && p[33]>=126 && p[33]<=129 && p[98]>=127 && p[98]<=129 ? 0 : 6;
  }
}
