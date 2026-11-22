#include "PxPhysicsAPI.h"
#include "cooking/PxCooking.h"
#include "extensions/PxExtensionsAPI.h"

#include <atomic>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <memory>
#include <stdexcept>

using namespace physx;

static_assert(PX_PHYSICS_VERSION_MAJOR == 5 && PX_PHYSICS_VERSION_MINOR == 12 && PX_PHYSICS_VERSION_BUGFIX == 0);
static_assert(sizeof(void*) == 8);
#if !defined(__APPLE__) || !defined(__aarch64__)
#error Cette qualification doit être exécutée sur macOS arm64.
#endif

struct Allocateur : PxDefaultAllocator {
    std::atomic<int> blocs{0};
    void* allocate(size_t n, const char* type, const char* fichier, int ligne) override {
        void* p = PxDefaultAllocator::allocate(n, type, fichier, ligne);
        if (p) ++blocs;
        return p;
    }
    void deallocate(void* p) override {
        if (p) --blocs;
        PxDefaultAllocator::deallocate(p);
    }
};
struct Erreurs : PxErrorCallback {
    std::atomic<int> total{0};
    void reportError(PxErrorCode::Enum code, const char* msg, const char*, int) override {
        std::fprintf(stderr, "PhysX %d : %s\n", int(code), msg);
        if (code != PxErrorCode::eDEBUG_INFO) ++total;
    }
};
struct Liberation {
    template<class T> void operator()(T* p) const { p->release(); }
};
template<class T> auto garder(T* p) {
    if (!p) throw std::runtime_error("création d'une ressource PhysX");
    return std::unique_ptr<T, Liberation>{p};
}
void exiger(bool ok, const char* texte) {
    if (!ok) throw std::runtime_error(texte);
}
struct Contacts : PxSimulationEventCallback {
    const PxActor* sol = nullptr;
    const PxActor* balle = nullptr;
    int debut = -1, pas = 0, nbPoints = 0;
    float normaleY = 0;
    void onContact(const PxContactPairHeader& paire, const PxContactPair* contacts, PxU32 n) override {
        if (!((paire.actors[0] == sol && paire.actors[1] == balle) ||
              (paire.actors[1] == sol && paire.actors[0] == balle))) return;
        for (PxU32 i = 0; i < n; ++i) {
            if (!(contacts[i].events & PxPairFlag::eNOTIFY_TOUCH_FOUND)) continue;
            PxContactPairPoint points[4];
            const PxU32 recus = contacts[i].extractContacts(points, 4);
            nbPoints += int(recus);
            if (recus) {
                if (debut < 0) debut = pas;
                normaleY = std::fabs(points[0].normal.y);
            }
        }
    }
    void onConstraintBreak(PxConstraintInfo*, PxU32) override {}
    void onWake(PxActor**, PxU32) override {}
    void onSleep(PxActor**, PxU32) override {}
    void onTrigger(PxTriggerPair*, PxU32) override {}
    void onAdvance(const PxRigidBody* const*, const PxTransform*, PxU32) override {}
};
PxFilterFlags filtre(PxFilterObjectAttributes, PxFilterData, PxFilterObjectAttributes, PxFilterData,
                     PxPairFlags& flags, const void*, PxU32) {
    flags = PxPairFlag::eCONTACT_DEFAULT | PxPairFlag::eNOTIFY_TOUCH_FOUND | PxPairFlag::eNOTIFY_CONTACT_POINTS;
    return PxFilterFlag::eDEFAULT;
}
void simuler(Allocateur& alloc, Erreurs& erreurs) {
    auto fondation = garder(PxCreateFoundation(PX_PHYSICS_VERSION, alloc, erreurs));
    const PxTolerancesScale echelle;
    auto moteur = garder(PxCreatePhysics(PX_PHYSICS_VERSION, *fondation, echelle));
    auto cpu = garder(PxDefaultCpuDispatcherCreate(2));
    Contacts contacts;
    PxSceneDesc description(echelle);
    description.gravity = PxVec3(0, -9.81f, 0);
    description.cpuDispatcher = cpu.get();
    description.filterShader = filtre;
    description.simulationEventCallback = &contacts;
    auto scene = garder(moteur->createScene(description));
    auto mat = garder(moteur->createMaterial(.6f, .5f, 0.f));
    const PxVec3 points[] = {{-10,0,-10}, {0,0,10}, {10,0,-10}};
    const PxU32 indices[] = {0,1,2};
    PxTriangleMeshDesc triangle;
    triangle.points.count = 3; triangle.points.stride = sizeof(PxVec3); triangle.points.data = points;
    triangle.triangles.count = 1; triangle.triangles.stride = sizeof(indices); triangle.triangles.data = indices;
    auto maillage = garder(PxCreateTriangleMesh(PxCookingParams(echelle), triangle, moteur->getPhysicsInsertionCallback()));
    auto sol = garder(moteur->createRigidStatic(PxTransform(PxIdentity)));
    auto solForme = garder(moteur->createShape(PxTriangleMeshGeometry(maillage.get()), *mat));
    exiger(maillage->getNbTriangles() == 1 && sol->attachShape(*solForme), "collision du triangle");
    auto balle = garder(moteur->createRigidDynamic(PxTransform(PxVec3(0, 2, 0))));
    auto sphere = garder(moteur->createShape(PxSphereGeometry(.35f), *mat));
    exiger(balle->attachShape(*sphere), "collision de la sphère");
    contacts.sol = sol.get(); contacts.balle = balle.get();
    scene->addActor(*sol); scene->addActor(*balle);

    PxRaycastBuffer hit, miss;
    const PxVec3 bas(0,-1,0);
    exiger(scene->raycast(PxVec3(3,3,0), bas, 5, hit) && hit.hasBlock && hit.block.actor == sol.get() &&
           hit.block.faceIndex == 0 && std::fabs(hit.block.distance - 3) < .001f && hit.block.normal.y > .99f,
           "le rayon doit retrouver le triangle à trois mètres");
    exiger(!scene->raycast(PxVec3(20,3,0), bas, 5, miss), "le rayon hors triangle doit manquer");
    float y24 = 0;
    for (int i = 1; i <= 360; ++i) {
        contacts.pas = i;
        scene->simulate(1.f / 120);
        exiger(scene->fetchResults(true), "pas de simulation incomplet");
        if (i == 24) y24 = balle->getGlobalPose().p.y;
    }
    const float y = balle->getGlobalPose().p.y, vy = balle->getLinearVelocity().y;
    exiger(y24 > 1.77f && y24 < 1.83f && contacts.debut > 60 && contacts.debut < 78 &&
           contacts.nbPoints > 0 && contacts.normaleY > .99f && std::fabs(y - .35f) < .012f &&
           std::fabs(vy) < .05f, "chute, contact ou position finale inattendue");
    std::printf("pas=360 dt=1/120 y_apres_24=%.6f premier_contact=%d points=%d normale_abs_y=%.3f y_final=%.6f vy_final=%.6f\n",
                y24, contacts.debut, contacts.nbPoints, contacts.normaleY, y, vy);
    std::printf("rayon_face=%u distance=%.6f normale_y=%.3f rayon_exterieur=manque\n",
                hit.block.faceIndex, hit.block.distance, hit.block.normal.y);
}
int main() {
    try {
        Allocateur alloc; Erreurs erreurs;
        simuler(alloc, erreurs);
        std::printf("sdk=5.12.0 arch=arm64 backend=CPU erreurs=%d allocations_restantes=%d\n",
                    erreurs.total.load(), alloc.blocs.load());
        exiger(erreurs.total == 0 && alloc.blocs == 0, "libération du monde ou erreur SDK");
        return EXIT_SUCCESS;
    } catch (const std::exception& e) {
        std::fprintf(stderr, "Échec : %s\n", e.what());
        return EXIT_FAILURE;
    }
}
