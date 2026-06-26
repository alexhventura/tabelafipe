import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FamilySearchItem, VehicleTipo } from '../types';
import { FamilyCatalog } from '../lib/familyCatalog';
import {
  type GuidedMarca,
  type GuidedStep,
  type GuidedVersao,
  type FamilyHubBundle,
  familyHubPath,
  resolveFamilyHubSlug,
  filterFamilies,
  filterMarcas,
  filterVersions,
  groupHubVersions,
} from '../lib/guidedSearch';
import { loadMarcasIndex, type SeoMarcaIndex } from '../lib/seo-data';

let sharedFamilyCatalog: FamilyCatalog | null = null;
let sharedMarcasIndexPromise: Promise<GuidedMarca[]> | null = null;

async function loadAllMarcas(): Promise<GuidedMarca[]> {
  if (!sharedMarcasIndexPromise) {
    sharedMarcasIndexPromise = loadMarcasIndex()
      .then((rows) => rows.map(toGuidedMarca))
      .catch(() => [] as GuidedMarca[]);
  }
  return sharedMarcasIndexPromise;
}

async function getFamilyCatalog(): Promise<FamilyCatalog | null> {
  if (sharedFamilyCatalog) return sharedFamilyCatalog;
  for (const base of ['/data/fipe/search', '/api/fipe/search', '/api/search']) {
    const cat = new FamilyCatalog(base);
    const ok = await cat.init();
    if (ok) {
      sharedFamilyCatalog = cat;
      return cat;
    }
  }
  return null;
}

function toGuidedMarca(m: SeoMarcaIndex): GuidedMarca {
  return {
    slug: m.slug,
    nome: m.nome,
    tipo: (m.tipo as VehicleTipo) ?? 'carros',
    totalModelos: m.totalModelos,
    totalVeiculos: m.totalVeiculos,
  };
}

export function useGuidedSearch(tipo: VehicleTipo) {
  const navigate = useNavigate();
  const [step, setStep] = useState<GuidedStep>('marca');
  const [marcaQuery, setMarcaQuery] = useState('');
  const [modeloQuery, setModeloQuery] = useState('');
  const [versaoQuery, setVersaoQuery] = useState('');
  const [marcas, setMarcas] = useState<GuidedMarca[]>([]);
  const [marcasLoading, setMarcasLoading] = useState(true);
  const [familiesLoading, setFamiliesLoading] = useState(false);
  const [hubLoading, setHubLoading] = useState(false);
  const [families, setFamilies] = useState<FamilySearchItem[]>([]);
  const [versions, setVersions] = useState<GuidedVersao[]>([]);
  const [marca, setMarca] = useState<GuidedMarca | null>(null);
  const [modelo, setModelo] = useState<FamilySearchItem | null>(null);
  const [versao, setVersao] = useState<GuidedVersao | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMarcasLoading(true);

    const load = () => {
      loadAllMarcas().then((rows) => {
        if (cancelled) return;
        startTransition(() => {
          setMarcas(rows);
          setMarcasLoading(false);
        });
      });
    };

    if (typeof requestIdleCallback !== 'undefined') {
      const idleId = requestIdleCallback(load, { timeout: 1500 });
      return () => {
        cancelled = true;
        cancelIdleCallback(idleId);
      };
    }

    const timeoutId = window.setTimeout(load, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  const marcasForTipo = useMemo(
    () => marcas.filter((m) => m.tipo === tipo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [marcas, tipo],
  );

  const marcasFiltradas = useMemo(
    () => filterMarcas(marcasForTipo, marcaQuery),
    [marcasForTipo, marcaQuery],
  );

  const modelosFiltrados = useMemo(
    () => filterFamilies(families, modeloQuery),
    [families, modeloQuery],
  );

  const versoesFiltradas = useMemo(
    () => filterVersions(versions, versaoQuery),
    [versions, versaoQuery],
  );

  const resetFrom = useCallback((target: GuidedStep) => {
    if (target === 'marca') {
      setMarca(null);
      setModelo(null);
      setVersao(null);
      setFamilies([]);
      setVersions([]);
      setModeloQuery('');
      setVersaoQuery('');
      setStep('marca');
      return;
    }
    if (target === 'modelo') {
      setModelo(null);
      setVersao(null);
      setVersions([]);
      setModeloQuery('');
      setVersaoQuery('');
      setStep('modelo');
      return;
    }
    if (target === 'versao') {
      setVersao(null);
      setVersaoQuery('');
      setStep('versao');
    }
  }, []);

  const selectMarca = useCallback(async (next: GuidedMarca) => {
    setMarca(next);
    setModelo(null);
    setVersao(null);
    setVersions([]);
    setModeloQuery('');
    setVersaoQuery('');
    setStep('modelo');
    setFamiliesLoading(true);
    try {
      const catalog = await getFamilyCatalog();
      if (!catalog) {
        setFamilies([]);
        return;
      }
      await catalog.loadShardsForMarca(next.slug, tipo);
      setFamilies(catalog.getFamiliesForMarca(next.slug, tipo));
    } finally {
      setFamiliesLoading(false);
    }
  }, [tipo]);

  const selectModelo = useCallback(async (next: FamilySearchItem) => {
    if (!marca) return;
    setModelo(next);
    setVersao(null);
    setVersaoQuery('');
    setStep('versao');
    setHubLoading(true);
    try {
      const hubSlug = resolveFamilyHubSlug(next);
      let res = await fetch(familyHubPath(next.marcaSlug, hubSlug));
      if (!res.ok && hubSlug !== next.familia) {
        res = await fetch(familyHubPath(next.marcaSlug, next.familia));
      }
      if (!res.ok) {
        setVersions([]);
        return;
      }
      const hub = (await res.json()) as FamilyHubBundle;
      setVersions(groupHubVersions(hub.veiculos ?? [], marca.nome, next.familiaDisplay));
    } finally {
      setHubLoading(false);
    }
  }, [marca]);

  const selectVersao = useCallback((next: GuidedVersao) => {
    setVersao(next);
    setStep('ano');
  }, []);

  const selectAno = useCallback(
    (ano: number) => {
      if (!versao) return;
      const vehicle = versao.vehicleByAno.get(ano);
      if (!vehicle?.canonicalPath) return;
      navigate(vehicle.canonicalPath);
    },
    [navigate, versao],
  );

  const resetTipo = useCallback(() => {
    resetFrom('marca');
    setMarcaQuery('');
  }, [resetFrom]);

  return {
    step,
    marca,
    modelo,
    versao,
    marcasLoading,
    familiesLoading,
    hubLoading,
    marcaQuery,
    setMarcaQuery,
    modeloQuery,
    setModeloQuery,
    versaoQuery,
    setVersaoQuery,
    marcasFiltradas,
    modelosFiltrados,
    versoesFiltradas,
    selectMarca,
    selectModelo,
    selectVersao,
    selectAno,
    resetFrom,
    resetTipo,
    counts: {
      marcas: marcasFiltradas.length,
      modelos: modelosFiltrados.length,
      versoes: versoesFiltradas.length,
      anos: versao?.anos.length ?? 0,
    },
  };
}
