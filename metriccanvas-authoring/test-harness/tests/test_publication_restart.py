"""Persistent original publication commands reuse existing exact-confirmation protocol."""

import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str((_Path(__file__).resolve().parent / '../../examples').resolve()))
import sys
import tempfile
import unittest
from pathlib import Path
from copy import deepcopy

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT/'tool'), str(ROOT/'test-harness')]
from publish_stdio_server import PublicationProvider, PublicationSources, HumanEvents, prepare_request, context
from lifecycle_stdio_server import Identities
from metriccanvas_authoring.assets.lifecycle_publish import Publication
from metriccanvas_authoring.assets.publish_ports import PublicationDependencies
from adapter_template.storage.lifecycle_programs import SqliteLifecyclePrograms


class PublicationRestartTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'authoring.sqlite'
        self.identities, self.humans = Identities(), HumanEvents()
        self.provider, self.sources = PublicationProvider(self.humans), PublicationSources()
        self.restart()

    def restart(self):
        self.programs = SqliteLifecyclePrograms(self.path)
        self.app = Publication(PublicationDependencies(self.provider, self.humans), self.programs, self.identities, self.sources)

    async def store(self, command):
        return await self.programs.store(command, self.identities.current())

    async def ready(self):
        token = await self.store(prepare_request())
        self.assertEqual((await self.app.call('prepare', token))['status'], 'completed')
        return deepcopy(self.provider.candidates['v1'])

    async def test_lost_publish_receipt_restart_queries_original_persisted_command(self):
        candidate = await self.ready()
        command = {'kind':'publish', 'context':context('publish-persisted'), 'ref':candidate['ref'],
                   'confirmationToken':self.humans.simulate_human_action(candidate)}
        token = await self.store(command)
        self.provider.lose_ack = 'publish'
        result = await self.app.call('publish', token)
        self.assertEqual(result['status'], 'unknown')
        self.restart()
        self.assertEqual(await self.programs.load(token, self.identities.current()), command)
        recovered = await self.app.call('lookup', token)
        self.assertEqual(recovered['status'], 'completed', recovered)
        replay = await self.app.call('publish', token)
        self.assertEqual(recovered['template'], replay['template'])
        self.assertEqual(self.provider.writes['publish'], 1)
        self.assertEqual(recovered['template']['source'], candidate['ref']['source'])
        self.provider.denied = True
        self.assertEqual((await self.app.call('lookup', token))['code'], 'FORBIDDEN')

    async def test_restart_does_not_transfer_old_confirmation_to_revised_candidate(self):
        first = await self.ready()
        confirmation = self.humans.simulate_human_action(first)
        revise = {'kind':'revise','context':context('revise-persisted'), 'ref':first['ref'],
                  'corrections':{'retainDimensionValues':False}}
        revised = await self.app.call('revise', await self.store(revise))
        self.assertEqual(revised['status'], 'completed')
        invalid = {'kind':'publish', 'context':context('publish-wrong-confirmation'), 'ref':revised['ref'],
                   'confirmationToken':confirmation}
        token = await self.store(invalid)
        self.restart()
        response = await self.app.call('publish', token)
        self.assertEqual(response['code'], 'CANDIDATE_CHANGED', response)
        self.assertEqual(self.provider.writes['publish'], 0)
