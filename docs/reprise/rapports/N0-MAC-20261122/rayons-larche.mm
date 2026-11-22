#import <Foundation/Foundation.h>
#import <Metal/Metal.h>
#include <array>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <vector>

struct PointRoute { float x,y,z; };
struct Rayon { std::array<float,4> origineMin,directionMax; std::array<uint32_t,4> mode; };
struct Reponse { uint32_t touche,triangle; float distance,u,v; };
static_assert(sizeof(PointRoute)==12 && sizeof(Rayon)==48 && sizeof(Reponse)==20);
using Vecteur = std::array<double,3>;
static Vecteur lire(PointRoute p) { return {p.x,p.y,p.z}; }
static Vecteur moins(Vecteur a,Vecteur b) { return {a[0]-b[0],a[1]-b[1],a[2]-b[2]}; }
static double scalaire(Vecteur a,Vecteur b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
static Vecteur croix(Vecteur a,Vecteur b) { return {a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]}; }

struct Temoin { bool touche=false; unsigned triangle=0; double distance=0,u=0,v=0; };
// Möller–Trumbore en double, sans culling, dans le même intervalle borné que Metal.
static Temoin intersecterCPU(const std::vector<PointRoute>& points,const Rayon& r) {
    const auto& d=r.directionMax; const auto& o=r.origineMin;
    const Vecteur dir={d[0],d[1],d[2]}, origine={o[0],o[1],o[2]};
    Temoin proche;
    for (size_t i=0;i<points.size();i+=3) {
        const auto a=lire(points[i]), e1=moins(lire(points[i+1]),a), e2=moins(lire(points[i+2]),a);
        const auto h=croix(dir,e2); const double det=scalaire(e1,h);
        if (std::abs(det)<1e-12) continue;
        const auto v0=moins(origine,a); const double u=scalaire(v0,h)/det;
        if (u<0 || u>1) continue;
        const auto q=croix(v0,e1); const double v=scalaire(dir,q)/det;
        if (v<0 || u+v>1) continue;
        const double t=scalaire(e2,q)/det;
        if (t>=o[3] && t<=d[3] && (!proche.touche || t<proche.distance)) proche={true,(unsigned)i/3,t,u,v};
    }
    return proche;
}
static void exiger(bool ok, NSString* raison) {
    if (!ok) { fprintf(stderr,"%s\n",raison.UTF8String ?: "Échec de la sonde"); std::exit(1); }
}
static double terminer(id<MTLCommandBuffer> cb) {
    [cb commit]; [cb waitUntilCompleted];
    exiger(cb.status==MTLCommandBufferStatusCompleted,cb.error.localizedDescription);
    return 1000000.0*(cb.GPUEndTime-cb.GPUStartTime);
}
static double arrondi(double x) { return std::round(x*1000000.)/1000000.; }
int main(int argc,const char** argv) {
    @autoreleasepool {
        if (argc!=3) { fprintf(stderr,"usage : rayons <scene.json> <rayons.metallib>\n"); return 1; }
        auto gpu=MTLCreateSystemDefaultDevice();
        exiger(gpu && gpu.supportsRaytracing,@"Le GPU Metal ne gère pas le ray tracing");
        NSError* erreur=nil;
        auto sceneData=[NSData dataWithContentsOfFile:[NSString stringWithUTF8String:argv[1]]];
        exiger(sceneData!=nil,@"Scene JSON absente");
        NSDictionary* scene=[NSJSONSerialization JSONObjectWithData:sceneData options:0 error:&erreur];
        exiger([scene isKindOfClass:NSDictionary.class],erreur.localizedDescription);
        NSArray* entrees=scene[@"rayons"]; std::vector<PointRoute> points; std::vector<Rayon> rayons;
        for (NSArray* v in scene[@"points"]) points.push_back({[v[0] floatValue],[v[1] floatValue],[v[2] floatValue]});
        for (NSDictionary* e in entrees) {
            NSArray* o=e[@"origine"], *d=e[@"vers"];
            rayons.push_back({{[o[0] floatValue],[o[1] floatValue],[o[2] floatValue],0.001f},
                              {[d[0] floatValue],[d[1] floatValue],[d[2] floatValue],[e[@"portee"] floatValue]},
                              {unsigned([e[@"ombre"] boolValue]),0,0,0}});
        }
        exiger(points.size()>=3 && points.size()%3==0 && !rayons.empty(),@"Géométrie ou rayons vides");
        auto lib=[gpu newLibraryWithURL:[NSURL fileURLWithPath:[NSString stringWithUTF8String:argv[2]]] error:&erreur];
        exiger(lib!=nil,erreur.localizedDescription);
        auto fn=[lib newFunctionWithName:@"intersections"]; exiger(fn!=nil,@"Kernel intersections absent");
        auto pipeline=[gpu newComputePipelineStateWithFunction:fn error:&erreur]; exiger(pipeline!=nil,erreur.localizedDescription);
        auto file=[gpu newCommandQueue]; exiger(file!=nil,@"File Metal absente");
        auto vertices=[gpu newBufferWithBytes:points.data() length:points.size()*sizeof(PointRoute) options:MTLResourceStorageModeShared];
        auto triangles=[MTLAccelerationStructureTriangleGeometryDescriptor descriptor];
        triangles.vertexBuffer=vertices; triangles.vertexFormat=MTLAttributeFormatFloat3;
        triangles.vertexStride=sizeof(PointRoute); triangles.triangleCount=points.size()/3; triangles.opaque=YES;
        auto desc=[MTLPrimitiveAccelerationStructureDescriptor descriptor]; desc.geometryDescriptors=@[triangles];
        const MTLAccelerationStructureSizes tailles=[gpu accelerationStructureSizesWithDescriptor:desc];
        auto as=[gpu newAccelerationStructureWithSize:tailles.accelerationStructureSize];
        auto scratch=[gpu newBufferWithLength:tailles.buildScratchBufferSize options:MTLResourceStorageModePrivate];
        exiger(vertices && as && scratch,@"Allocation de la structure d’accélération impossible");
        auto construction=[file commandBuffer]; auto batir=[construction accelerationStructureCommandEncoder];
        [batir buildAccelerationStructure:as descriptor:desc scratchBuffer:scratch scratchBufferOffset:0]; [batir endEncoding];
        const double microsConstruction=terminer(construction);
        auto rays=[gpu newBufferWithBytes:rayons.data() length:rayons.size()*sizeof(Rayon) options:MTLResourceStorageModeShared];
        auto hits=[gpu newBufferWithLength:rayons.size()*sizeof(Reponse) options:MTLResourceStorageModeShared];
        exiger(rays && hits,@"Allocation des rayons impossible");
        NSMutableArray* commandes=[NSMutableArray array], *mesures=[NSMutableArray array];
        for (int passe=0;passe<4;passe++) {
            auto cb=[file commandBuffer]; auto enc=[cb computeCommandEncoder]; [enc setComputePipelineState:pipeline];
            [enc setAccelerationStructure:as atBufferIndex:0]; [enc setBuffer:rays offset:0 atIndex:1];
            [enc setBuffer:hits offset:0 atIndex:2];
            [enc dispatchThreads:MTLSizeMake(rayons.size(),1,1) threadsPerThreadgroup:MTLSizeMake(rayons.size(),1,1)];
            [enc endEncoding]; [commandes addObject:@(arrondi(terminer(cb)))];
            const auto* gpuHits=static_cast<const Reponse*>(hits.contents);
            for (size_t i=0;i<rayons.size();++i) {
                const auto ref=intersecterCPU(points,rayons[i]); const Reponse g=gpuHits[i];
                NSDictionary* def=entrees[i]; exiger(ref.touche==[def[@"attendu"] boolValue],@"Le rayon témoin diverge du scénario");
                exiger(bool(g.touche)==ref.touche,@"Désaccord CPU/GPU sur l’intersection");
                if (ref.touche) {
                    // Les rayons positifs de cette scène ne croisent qu’un triangle.
                    exiger(g.triangle==ref.triangle && std::abs(g.distance-ref.distance)<.0001 &&
                           std::abs(g.u-ref.u)<.0001 && std::abs(g.v-ref.v)<.0001,@"Primitive, distance ou barycentriques différentes");
                }
                if (!passe) [mesures addObject:@{@"rayon":def[@"nom"],@"ombre":def[@"ombre"],@"touche":@(ref.touche),
                    @"primitive":ref.touche ? @(g.triangle) : NSNull.null,
                    @"distanceCPU_M":ref.touche ? @(arrondi(ref.distance)) : NSNull.null,
                    @"distanceGPU_M":ref.touche ? @(g.distance) : NSNull.null,
                    @"ecartAbsoluM":ref.touche ? @(std::abs(g.distance-ref.distance)) : NSNull.null}];
            }
        }
        NSDictionary* recu=@{@"gpu":gpu.name,@"supportsRaytracing":@(gpu.supportsRaytracing),@"triangles":@(points.size()/3),
            @"octetsStructure":@(tailles.accelerationStructureSize),@"octetsScratch":@(tailles.buildScratchBufferSize),
            @"constructionGPUus":@(arrondi(microsConstruction)),@"commandesGPUus":commandes,@"rayons":mesures};
        NSData* donnees=[NSJSONSerialization dataWithJSONObject:recu options:NSJSONWritingSortedKeys error:&erreur];
        exiger(donnees!=nil,erreur.localizedDescription); fwrite(donnees.bytes,1,donnees.length,stdout); fputc('\n',stdout);
    }
}
